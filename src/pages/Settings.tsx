import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore, AIProvider, AIMode } from '@/src/store/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

import { AI_PROVIDERS } from '@/src/lib/providers';

export default function Settings() {
  const navigate = useNavigate();
  const settings = useSettingsStore();

  const [githubToken, setGithubToken] = useState(settings.githubToken);
  const [aiProvider, setAiProvider] = useState<AIProvider>(settings.aiProvider || 'custom');
  const [aiUrl, setAiUrl] = useState(settings.aiBaseUrl);
  const [aiKey, setAiKey] = useState(settings.aiApiKey);
  const [aiModel, setAiModel] = useState(settings.aiModel);
  const [aiMode, setAiMode] = useState<AIMode>(settings.aiMode);
  const [iterations, setIterations] = useState([settings.aiIterations]);
  const [theme, setTheme] = useState(settings.theme);
  
  const [models, setModels] = useState<{id: string, name: string}[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
     loadModels();
  }, [aiUrl, aiKey]);

  const loadModels = async () => {
     if (!aiUrl || !aiKey) return;
     setIsLoadingModels(true);
     try {
        // temp override states for the aiApi context (it reads from the store but we are editing locally - this is a bit hacky, so we might need a direct call)
        // actually aiApi uses store, so we might not load immediately unless saved, but we can just let users save to fetch models or we update the store temporarily.
        // for simplicity, let's just make them save first to refresh models.
        const available = await import('@/src/lib/ai').then(m => m.aiApi.fetchModels());
        if (available.length > 0) setModels(available);
     } catch (e) {
     } finally {
        setIsLoadingModels(false);
     }
  };

  const handleProviderChange = (val: AIProvider) => {
    setAiProvider(val);
    const provider = AI_PROVIDERS.find(p => p.id === val);
    if (provider) {
      setAiUrl(provider.defaultUrl);
    }
  };

  const handleSave = () => {
    settings.setGithubToken(githubToken);
    settings.setAISettings({
      aiProvider: aiProvider,
      aiBaseUrl: aiUrl,
      aiApiKey: aiKey,
      aiModel: aiModel,
      aiMode: aiMode,
      aiIterations: iterations[0]
    });
    settings.setTheme(theme);
    toast.success('Settings saved successfully');
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 overflow-auto">
      <header className="flex items-center gap-4 px-4 py-3 border-b bg-white dark:bg-zinc-900 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-semibold text-lg flex-1">Settings</h1>
        <Button onClick={handleSave}><Save className="w-4 h-4 mr-2" /> Save</Button>
      </header>

      <main className="p-6 max-w-3xl mx-auto w-full space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>GitHub Configuration</CardTitle>
            <CardDescription>Manage your Personal Access Token.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Personal Access Token</label>
              <Input 
                type="password" 
                value={githubToken} 
                onChange={e => setGithubToken(e.target.value)} 
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Provider</CardTitle>
            <CardDescription>Configure your custom AI agent endpoint.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-2">
                <label className="text-sm font-medium">Provider</label>
                <Select value={aiProvider} onValueChange={(val: any) => handleProviderChange(val)}>
                  <SelectTrigger>
                     <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                     {AI_PROVIDERS.map(p => (
                       <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                     ))}
                  </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
              <label className="text-sm font-medium">Base URL</label>
              <Input 
                value={aiUrl} 
                onChange={e => setAiUrl(e.target.value)} 
                disabled={aiProvider !== 'custom'}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              <Input 
                type="password" 
                value={aiKey} 
                onChange={e => setAiKey(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Model</label>
              <div className="flex gap-2">
                {models.length > 0 ? (
                  <Select value={aiModel || undefined} onValueChange={setAiModel}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                       {models.map(m => (
                         <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                       ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input 
                    className="flex-1"
                    value={aiModel} 
                    onChange={e => setAiModel(e.target.value)} 
                    placeholder="e.g. gpt-4o"
                  />
                )}
                <Button variant="outline" size="sm" onClick={() => {
                   settings.setAISettings({ aiProvider, aiBaseUrl: aiUrl, aiApiKey: aiKey });
                   loadModels();
                }} disabled={isLoadingModels}>
                  Load Models
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Behavior</CardTitle>
            <CardDescription>How should the agent act on failures?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
               <label className="text-sm font-medium">Evaluation Mode</label>
               <Select value={aiMode} onValueChange={(v: AIMode) => setAiMode(v)}>
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="manual">Manual (I click analyze)</SelectItem>
                   <SelectItem value="semi-auto">Semi-Auto (Auto analyze, manual fix)</SelectItem>
                   <SelectItem value="full-auto">Full-Auto (Fix and Push)</SelectItem>
                 </SelectContent>
               </Select>
            </div>
            
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <label className="text-sm font-medium">Max Auto Iterations</label>
                 <span className="text-sm text-zinc-500">{iterations[0]}</span>
               </div>
               <Slider 
                 min={1} max={10} step={1} 
                 value={iterations} 
                 onValueChange={(val: any) => setIterations(val)} 
               />
               <p className="text-xs text-zinc-500">
                 Limits how many times the agent will retry fixing a build in full-auto mode.
               </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Theme settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-2">
               <label className="text-sm font-medium">Theme</label>
               <Select value={theme} onValueChange={(v: any) => setTheme(v)}>
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="light">Light</SelectItem>
                   <SelectItem value="dark">Dark</SelectItem>
                   <SelectItem value="system">System Default</SelectItem>
                 </SelectContent>
               </Select>
             </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
