import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { githubApi } from '@/src/lib/github';
import { aiApi, AIMessage } from '@/src/lib/ai';
import { useSettingsStore } from '@/src/store/settings';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Play, Download, Terminal, Bot, Sparkles, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import Ansi from 'ansi-to-react';

export default function RepoDetails() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();
  const settings = useSettingsStore();
  
  const [activeTab, setActiveTab] = useState('workflows');
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  
  // Workflows state
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [logs, setLogs] = useState('');
  
  // Chat state
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Artifacts
  const [artifacts, setArtifacts] = useState<any[]>([]);

  // Files state
  const [tree, setTree] = useState<any[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileSha, setFileSha] = useState('');
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [fileSearch, setFileSearch] = useState('');

  const logsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Poll for runs if active
  const { data: runsData, refetch: refetchRuns } = useQuery({
    queryKey: ['runs', owner, repo],
    queryFn: () => githubApi.getRuns(owner!, repo!),
    refetchInterval: 5000, // Every 5s
  });

  useEffect(() => {
    if (runsData && runsData.workflow_runs) {
      setRuns(runsData.workflow_runs);
      if (!selectedRunId && runsData.workflow_runs.length > 0) {
        setSelectedRunId(runsData.workflow_runs[0].id);
      }
    }
  }, [runsData]);

  // Fetch jobs for selected run
  useEffect(() => {
    if (selectedRunId) {
      githubApi.getRunJobs(owner!, repo!, selectedRunId).then(data => {
        if (data.jobs) {
          setJobs(data.jobs);
          if (data.jobs.length > 0 && !selectedJobId) {
            setSelectedJobId(data.jobs[0].id);
          }
        }
      }).catch(() => toast.error('Failed to load jobs'));
    }
  }, [selectedRunId]);

  // Fetch / Poll Logs
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (selectedJobId) {
      const fetchLog = async () => {
        try {
          const logText = await githubApi.getJobLogs(owner!, repo!, selectedJobId);
          setLogs(logText);
           // Auto-analyze if full-auto or semi-auto and failed
           const currentJob = jobs.find(j => j.id === selectedJobId);
           if (currentJob?.conclusion === 'failure' && logs.length === 0 && logText.length > 0) {
             if (settings.aiMode === 'semi-auto' || settings.aiMode === 'full-auto') {
                handleAnalyzeError(logText);
             }
           }
        } catch (e) {
          // Logs might not be ready
        }
      };
      
      fetchLog();
      interval = setInterval(fetchLog, 3000);
    }
    return () => clearInterval(interval);
  }, [selectedJobId]);

  // Auto scroll
  useEffect(() => {
    if (autoScrollLogs) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScrollLogs]);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load Artifacts when switching tabs
  useEffect(() => {
      if (activeTab === 'artifacts') {
          githubApi.getArtifacts(owner!, repo!).then(data => {
              if (data.artifacts) setArtifacts(data.artifacts);
          })
      }
      
      if (activeTab === 'files' && tree.length === 0) {
        githubApi.getBranch(owner!, repo!, 'main').then(data => {
          githubApi.getTree(owner!, repo!, data.commit.sha).then(treeData => {
             setTree(treeData.tree.filter((t: any) => t.type === 'blob'));
          });
        }).catch(() => toast.error('Failed to load file tree. Branch might not be main.'));
      }
  }, [activeTab, owner, repo, tree.length]);

  useEffect(() => {
    if (selectedFilePath && activeTab === 'files') {
      githubApi.getFile(owner!, repo!, selectedFilePath).then(res => {
         setFileSha(res.sha);
         setFileContent(decodeURIComponent(escape(atob(res.content))));
      }).catch(() => toast.error('Failed to load file'));
    }
  }, [selectedFilePath, activeTab, owner, repo]);

  const handleAnalyzeError = async (logData = logs) => {
    if (!logData) return toast.info("No logs available to analyze.");
    setIsAnalyzing(true);
    
    // Grab the last 20k chars to avoid token limits, plus some context
    const recentLogs = logData.slice(-20000);
    
    const userMessage: AIMessage = {
      role: 'user',
      content: `Analyze this CI/CD failure and provide a step-by-step fix or unified diff if it's a code/yaml issue.\n\nIf you want to apply a fix, output ONE JSON block like this:\n\`\`\`json\n{ "file_path": "path/to/file", "new_content": "entire new file content here" }\n\`\`\`\n\nLogs:\n${recentLogs}`
    };
    
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    
    try {
      const systemMsg: AIMessage = { role: 'system', content: 'You are an expert DevOps AI agent fixing CI/CD pipeline errors. Propose concise, actionable fixes.' };
      const res = await aiApi.chatCompletion([systemMsg, ...newMessages]);
      setMessages([...newMessages, { role: 'assistant', content: res }]);
    } catch(e: any) {
      toast.error(e.message || "Failed to analyze error");
      setMessages([...newMessages, { role: 'assistant', content: "Sorry, I couldn't analyze that due to an API error."}]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sendChatMessage = async () => {
    if (!input.trim()) return;
    const userMessage: AIMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsAnalyzing(true);

    try {
      const systemMsg: AIMessage = { role: 'system', content: 'You are a helpful DevOps assistant.' };
      const res = await aiApi.chatCompletion([systemMsg, ...newMessages]);
      setMessages([...newMessages, { role: 'assistant', content: res }]);
    } catch (e: any) {
       toast.error(e.message);
    } finally {
       setIsAnalyzing(false);
    }
  };

  const triggerRun = async () => {
    try {
       // Just grab first workflow file? usually we need ID. It's complex without fetching workflows list.
       // Let's prompt for branch branch temporarily or just 'main'
       toast.error("Manual trigger UI not fully implemented, requires workflow ID.");
    } catch(e) {}
  };

  const saveFile = async () => {
     if (!selectedFilePath || !fileSha) return;
     setIsSavingFile(true);
     try {
       const encodedContent = btoa(unescape(encodeURIComponent(fileContent)));
       const res = await githubApi.updateFile(owner!, repo!, selectedFilePath, `Direct update from GitOps: ${selectedFilePath}`, encodedContent, fileSha, 'main');
       if (res.content?.sha) setFileSha(res.content.sha);
       toast.success("Successfully committed and pushed to main!");
     } catch (e: any) {
       toast.error(e.message || "Failed to save file.");
     } finally {
       setIsSavingFile(false);
     }
  };
  
  const applyCodeFix = async (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.file_path || !data.new_content) throw new Error('Missing file_path or new_content in JSON');
      
      setIsAnalyzing(true);
      // Get current file sha
      const fileRes = await githubApi.getFile(owner!, repo!, data.file_path);
      const sha = fileRes.sha;
      if (!sha) throw new Error('Could not get file SHA to update');

      const encodedContent = btoa(unescape(encodeURIComponent(data.new_content)));
      await githubApi.updateFile(owner!, repo!, data.file_path, `AI Fix for ${data.file_path}`, encodedContent, sha, 'main');
      
      toast.success(`Successfully applied fix to ${data.file_path}`);
      setMessages([...messages, { role: 'assistant', content: `✅ Applied fix to ${data.file_path}.\nThe workflow should automatically re-run if it's watched on the main branch.` }]);
    } catch(e: any) {
      toast.error('Failed to apply fix: ' + e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderMessageContent = (content: string) => {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return (
        <div className="space-y-2">
           <div className="markdown-body text-sm prose dark:prose-invert">
             <ReactMarkdown>{content.replace(jsonMatch[0], '')}</ReactMarkdown>
           </div>
           <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-md flex flex-col gap-2">
             <span className="text-xs font-semibold text-emerald-400">AI Code Proposal</span>
             <pre className="text-xs overflow-x-auto text-zinc-300 bg-black p-2 rounded">{jsonMatch[1]}</pre>
             <Button size="sm" onClick={() => applyCodeFix(jsonMatch[1])}>Apply Fix</Button>
           </div>
        </div>
      )
    }
    return (
       <div className="markdown-body text-sm prose dark:prose-invert">
          <ReactMarkdown>{content}</ReactMarkdown>
       </div>
    );
  };

  const downloadAPK = async (artifactId: number, name: string) => {
      try {
          const blob = await githubApi.downloadArtifact(owner!, repo!, artifactId);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${name}.zip`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
      } catch (e) {
          toast.error("Failed to download artifact");
      }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-3 border-b bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-semibold text-lg">{owner}/{repo}</h1>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[400px]">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'workflows' && (
          <div className="flex flex-col h-full">
             {/* Toolbar */}
             <div className="flex items-center gap-4 p-2 bg-zinc-100 dark:bg-zinc-900 border-b">
                 <Select value={selectedRunId?.toString()} onValueChange={v => setSelectedRunId(Number(v))}>
                   <SelectTrigger className="w-[250px]">
                     <SelectValue placeholder="Select a run..." />
                   </SelectTrigger>
                   <SelectContent>
                      {runs.map(run => (
                         <SelectItem key={run.id} value={run.id.toString()}>
                           {new Date(run.created_at).toLocaleDateString()} - {run.name}
                         </SelectItem>
                      ))}
                   </SelectContent>
                 </Select>

                 <Select value={selectedJobId?.toString()} onValueChange={v => setSelectedJobId(Number(v))}>
                   <SelectTrigger className="w-[200px]">
                     <SelectValue placeholder="Select job..." />
                   </SelectTrigger>
                   <SelectContent>
                      {jobs.map(job => (
                         <SelectItem key={job.id} value={job.id.toString()}>
                           {job.name} ({job.status})
                         </SelectItem>
                      ))}
                   </SelectContent>
                 </Select>
                 
                 <div className="flex-1"></div>

                 <Button variant="outline" size="sm" onClick={() => refetchRuns()}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                 </Button>
             </div>

             {/* Split View */}
             <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Top 60%: Logs terminal */}
                <div className="flex-[6_6_0%] border-b dark:border-zinc-800 bg-zinc-950 overflow-hidden relative">
                   <div className="absolute top-2 right-2 bg-zinc-800 bg-opacity-70 px-2 py-1 rounded text-xs text-zinc-300 font-mono flex items-center gap-3 z-10 shadow-sm border border-zinc-700">
                     <span className="flex items-center gap-1"><Terminal className="w-3 h-3" /> Terminal</span>
                     {jobs.find(j => j.id === selectedJobId)?.status === 'in_progress' && (
                        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-950/50 px-2 py-0.5 rounded-full">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          Running
                        </span>
                     )}
                     {jobs.find(j => j.id === selectedJobId)?.status === 'completed' && (
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${jobs.find(j => j.id === selectedJobId)?.conclusion === 'success' ? 'text-emerald-400 bg-emerald-950/50' : 'text-red-400 bg-red-950/50'}`}>
                           {jobs.find(j => j.id === selectedJobId)?.conclusion === 'success' ? 'Completed' : 'Failed'}
                        </span>
                     )}
                   </div>
                   <ScrollArea className="h-full w-full" onScrollCapture={(e) => {
                      const target = e.currentTarget;
                      const atBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
                      setAutoScrollLogs(atBottom);
                   }}>
                       <pre className="p-4 text-xs font-mono text-zinc-300 whitespace-pre-wrap break-all">
                          {!logs ? "Waiting for logs..." : (
                             logs.split('\n').slice(-2000).map((line, idx) => {
                               // Extract timestamps and ignore raw GH action steps if desired
                               const cleanedLine = line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z /, '');
                               const lowerLine = cleanedLine.toLowerCase();
                               const isError = lowerLine.includes('error') || lowerLine.includes('failed') || lowerLine.includes('exception');
                               const isGroup = cleanedLine.startsWith('##[group]');
                               const isEndGroup = cleanedLine.startsWith('##[endgroup]');
                               
                               if (isGroup || isEndGroup) return null; // hide raw github action groups

                               return (
                                  <div key={idx} className={`px-1 rounded mb-[1px] ${isError ? 'text-red-400 bg-red-950/30 font-semibold border-l-2 border-red-500' : 'hover:bg-zinc-800/50'}`}>
                                     <Ansi>{cleanedLine}</Ansi>
                                  </div>
                               );
                             })
                          )}
                          <div ref={logsEndRef} />
                       </pre>
                   </ScrollArea>
                </div>

                {/* Bottom 40%: AI Chat */}
                <div className="flex-[4_4_0%] bg-zinc-50 dark:bg-zinc-900 flex flex-col pt-1">
                   {/* Chat Header */}
                   <div className="px-4 py-2 flex items-center justify-between border-b bg-white dark:bg-zinc-950">
                       <div className="flex items-center gap-2 text-sm font-medium">
                         <Bot className="w-4 h-4 text-blue-500" />
                         AI Agent
                       </div>
                       <Button size="sm" variant="secondary" onClick={() => handleAnalyzeError(logs)} disabled={isAnalyzing || !logs}>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Analyze Current Error
                       </Button>
                   </div>
                   
                   {/* Messages */}
                   <ScrollArea className="flex-1 p-4">
                     <div className="space-y-4">
                        {messages.length === 0 && (
                          <div className="text-center text-zinc-500 text-sm mt-4">
                            Click "Analyze Current Error" or say hi to get started. 
                            The agent has context of your current repo and selected logs.
                          </div>
                        )}
                        {messages.map((m, i) => (
                           <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                                m.role === 'user' 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                              }`}>
                                {m.role === 'assistant' ? (
                                   renderMessageContent(m.content)
                                ) : (
                                   m.content
                                )}
                              </div>
                           </div>
                        ))}
                        {isAnalyzing && (
                          <div className="flex justify-start">
                             <div className="bg-zinc-200 dark:bg-zinc-800 text-zinc-500 rounded-lg px-4 py-2 text-sm animate-pulse">
                               Thinking...
                             </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                     </div>
                   </ScrollArea>

                   {/* Input */}
                   <div className="p-3 border-t bg-white dark:bg-zinc-950 flex gap-2">
                      <Input 
                        placeholder="Ask the AI about the code or logs..." 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                        disabled={isAnalyzing}
                      />
                      <Button onClick={sendChatMessage} disabled={isAnalyzing || !input.trim()}>Send</Button>
                   </div>
                </div>
             </div>
          </div>
        )}
        
        {activeTab === 'files' && (
           <div className="flex flex-1 overflow-hidden h-full">
              <div className="w-1/3 border-r dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-900">
                 <div className="p-2 border-b dark:border-zinc-800">
                    <Input placeholder="Search files..." value={fileSearch} onChange={e => setFileSearch(e.target.value)} className="h-8 bg-white dark:bg-zinc-950" />
                 </div>
                 <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                       {tree.filter(t => t.path.toLowerCase().includes(fileSearch.toLowerCase())).slice(0, 200).map(t => (
                          <div 
                             key={t.path} 
                             onClick={() => setSelectedFilePath(t.path)}
                             className={`cursor-pointer text-sm p-1.5 px-2 rounded truncate ${selectedFilePath === t.path ? 'bg-zinc-200 dark:bg-zinc-800 font-medium' : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'}`}
                             title={t.path}
                           >
                             {t.path}
                          </div>
                       ))}
                    </div>
                 </ScrollArea>
              </div>
              <div className="w-2/3 flex flex-col bg-white dark:bg-zinc-950">
                 {selectedFilePath ? (
                    <>
                       <div className="flex items-center justify-between p-2 border-b dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                          <div className="font-medium text-sm truncate px-2 text-zinc-700 dark:text-zinc-300">{selectedFilePath}</div>
                          <Button size="sm" onClick={saveFile} disabled={isSavingFile}>
                             {isSavingFile ? 'Saving...' : 'Commit & Push'}
                          </Button>
                       </div>
                       <Textarea 
                          className="flex-1 rounded-none border-0 font-mono text-sm p-4 focus-visible:ring-0 resize-none h-full bg-transparent"
                          value={fileContent}
                          onChange={e => setFileContent(e.target.value)}
                          spellCheck={false}
                       />
                    </>
                 ) : (
                    <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
                       Select a file to view and edit
                    </div>
                 )}
              </div>
           </div>
        )}

        {activeTab === 'artifacts' && (
          <div className="p-6 max-w-5xl mx-auto w-full">
            <Card className="mb-6">
               <div className="p-4 border-b bg-zinc-100 dark:bg-zinc-900">
                  <h3 className="font-semibold text-sm">Example GitHub Action Snippet for APK (Capacitor/React Native)</h3>
               </div>
               <pre className="p-4 text-xs font-mono bg-zinc-950 text-emerald-400 overflow-x-auto rounded-b-lg">
{`- name: Build APK
  run: cd android && ./gradlew assembleRelease
- name: Upload Artifact
  uses: actions/upload-artifact@v4
  with:
    name: app-release
    path: android/app/build/outputs/apk/release/app-release.apk`}
               </pre>
            </Card>

            <h2 className="text-xl font-bold mb-4">Available Artifacts</h2>
            {artifacts.length === 0 ? (
               <div className="text-zinc-500 text-center py-10">No artifacts found. Make sure your workflows upload them.</div>
            ) : (
               <div className="grid gap-4">
                  {artifacts.map(art => (
                     <Card key={art.id} className="flex flex-row items-center justify-between p-4">
                        <div>
                           <div className="font-medium flex items-center gap-2">
                             {art.name}
                             {art.expired && <Badge variant="destructive">Expired</Badge>}
                           </div>
                           <div className="text-sm text-zinc-500">
                              {(art.size_in_bytes / 1024 / 1024).toFixed(2)} MB • Created at {new Date(art.created_at).toLocaleDateString()}
                           </div>
                        </div>
                        <Button 
                          variant="outline" 
                          disabled={art.expired}
                          onClick={() => downloadAPK(art.id, art.name)}
                        >
                           <Download className="w-4 h-4 mr-2" /> Download
                        </Button>
                     </Card>
                  ))}
               </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
