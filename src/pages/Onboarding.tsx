import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '@/src/store/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { aiApi } from '@/src/lib/ai';
import { githubApi } from '@/src/lib/github';
import { toast } from 'sonner';

import { AI_PROVIDERS } from '@/src/lib/providers';
import { AIProvider } from '@/src/store/settings';

export default function Onboarding() {
  const navigate = useNavigate();
  const setGithubToken = useSettingsStore((s) => s.setGithubToken);
  const setAISettings = useSettingsStore((s) => s.setAISettings);
  
  const [step, setStep] = useState(1);
  const [githubToken, setGithubTokenLocal] = useState('');
  const [aiProvider, setAiProvider] = useState<AIProvider>('custom');
  const [aiUrl, setAiUrl] = useState('');
  const [aiKey, setAiKey] = useState('');
  const [models, setModels] = useState<{id: string, name: string}[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleProviderChange = (val: AIProvider) => {
    setAiProvider(val);
    const provider = AI_PROVIDERS.find(p => p.id === val);
    if (provider) {
      setAiUrl(provider.defaultUrl);
    }
  };

  const testGitHub = async () => {
    setIsLoading(true);
    setGithubToken(githubToken); // temporary set to test
    try {
      await githubApi.getRepos();
      toast.success('GitHub Token is valid!');
      setStep(3);
    } catch (e) {
      toast.error('Invalid GitHub token. Ensure you selected all scopes.');
    } finally {
      setIsLoading(false);
    }
  };

  const testAI = async () => {
    setIsLoading(true);
    setAISettings({ aiProvider, aiBaseUrl: aiUrl, aiApiKey: aiKey });
    try {
      const availableModels = await aiApi.fetchModels();
      if (availableModels.length > 0) {
        setModels(availableModels);
        setSelectedModel(availableModels[0].id);
      }
      toast.success('AI API connection successful!');
      setStep(4);
    } catch (e) {
      toast.error('Failed to communicate with AI API. Check URL and Key.');
    } finally {
      setIsLoading(false);
    }
  };

  const finish = () => {
    setAISettings({ aiModel: selectedModel, aiMode: 'manual' });
    navigate('/dashboard');
  };

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <Card className="w-full max-w-md">
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Welcome to GitOps AI Manager</CardTitle>
              <CardDescription>
                Full Github management with an autonomous AI Agent to fix your CI/CD pipelines.
              </CardDescription>
            </CardHeader>
            <CardContent>
               <p className="text-sm text-zinc-600 dark:text-zinc-400">
                 All data (tokens, keys) remains secure in your browser. No proprietary backend is used. 
               </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={() => setStep(2)}>Get Started</Button>
            </CardFooter>
          </>
        )}

        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>GitHub Authentication</CardTitle>
              <CardDescription>
                Create a Personal Access Token (Classic) with all `repo`, `workflow`, `delete_repo`, `admin:repo_hook`, `admin:org`, and `read:org` scopes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-blue-600 underline">
                 <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer">
                   Click here to generate your Github Token
                 </a>
              </div>
              <Input
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxx"
                value={githubToken}
                onChange={(e) => setGithubTokenLocal(e.target.value)}
              />
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button disabled={!githubToken || isLoading} onClick={testGitHub}>
                 {isLoading ? 'Verifying...' : 'Next'}
              </Button>
            </CardFooter>
          </>
        )}

        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle>AI Provider Setup</CardTitle>
              <CardDescription>
                Connect any OpenAI-compatible (or Anthropic) provider.
              </CardDescription>
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
                  placeholder="https://api.openai.com/v1"
                  value={aiUrl}
                  onChange={(e) => setAiUrl(e.target.value)}
                  disabled={aiProvider !== 'custom'}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">API Key</label>
                <Input
                  type="password"
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxx"
                  value={aiKey}
                  onChange={(e) => setAiKey(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <Button disabled={!aiUrl || !aiKey || isLoading} onClick={testAI}>
                {isLoading ? 'Testing...' : 'Next'}
              </Button>
            </CardFooter>
          </>
        )}

        {step === 4 && (
          <>
            <CardHeader>
              <CardTitle>Select Model</CardTitle>
              <CardDescription>
                Choose the model you want to use for CI/CD fixes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Selected Model</label>
                {models.length > 0 ? (
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
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
                     placeholder="e.g. gpt-4o, llama3" 
                     value={selectedModel}
                     onChange={e => setSelectedModel(e.target.value)}
                   />
                )}
                
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
              <Button disabled={!selectedModel} onClick={finish}>Let's Go</Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
