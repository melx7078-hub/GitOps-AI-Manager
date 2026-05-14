import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { githubApi } from '@/src/lib/github';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { BookMarked, Plus, Settings } from 'lucide-react';
import { useSettingsStore } from '@/src/store/settings';

export default function Dashboard() {
  const navigate = useNavigate();
  const [repos, setRepos] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Create Repo dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadRepos();
  }, []);

  const loadRepos = async () => {
    try {
      const data = await githubApi.getRepos();
      setRepos(data);
    } catch (e: any) {
      toast.error('Failed to load repositories');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRepo = async () => {
    setCreating(true);
    try {
      await githubApi.createRepo({ name: newRepoName, description: newRepoDesc, private: newRepoPrivate });
      toast.success('Repository created successfully');
      setIsDialogOpen(false);
      setNewRepoName('');
      setNewRepoDesc('');
      loadRepos();
    } catch (e) {
      toast.error('Failed to create repository');
    } finally {
      setCreating(false);
    }
  };

  const filteredRepos = repos.filter(r => r.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
        <h1 className="text-xl font-bold flex items-center gap-2">
           <BookMarked className="w-5 h-5 text-blue-600" />
           GitOps Manager
        </h1>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>
      
      <main className="flex-1 overflow-auto p-6 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <Input 
            placeholder="Search repositories..." 
            className="w-full sm:max-w-md"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> New Repository
              </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a new repository</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Repository Name</label>
                  <Input value={newRepoName} onChange={e => setNewRepoName(e.target.value)} placeholder="e.g. my-awesome-app" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input value={newRepoDesc} onChange={e => setNewRepoDesc(e.target.value)} placeholder="Keep it simple" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Private Repository</label>
                  <Switch checked={newRepoPrivate} onCheckedChange={setNewRepoPrivate} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button disabled={!newRepoName || creating} onClick={handleCreateRepo}>
                   {creating ? 'Creating...' : 'Create Repo'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center text-zinc-500 mt-10">Loading repositories...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRepos.map(repo => (
              <Card 
                key={repo.id} 
                className="cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => navigate(`/repo/${repo.owner.login}/${repo.name}`)}
              >
                <CardHeader>
                  <CardTitle className="text-lg truncate flex items-center justify-between">
                    {repo.name}
                    <span className="text-xs font-normal px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400">
                      {repo.private ? 'Private' : 'Public'}
                    </span>
                  </CardTitle>
                  <CardDescription className="line-clamp-2 min-h-[40px]">
                    {repo.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
            {filteredRepos.length === 0 && (
              <div className="col-span-full text-center py-10 text-zinc-500">
                No repositories found matching "{search}".
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
