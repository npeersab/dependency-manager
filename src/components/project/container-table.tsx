"use client";

import { useState } from "react";
import type { Container } from "@prisma/client";
import { Pencil, Trash2, RefreshCw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { checkContainer, updateContainer, deleteContainer, addContainer } from "@/lib/actions";
import { imageLabel } from "@/lib/image";
import { toast } from "sonner";

export function ContainerTable({
  projectId,
  containers,
  onAdded,
}: {
  projectId: number;
  containers: Container[];
  onAdded: () => void;
}) {
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = async (id: number) => {
    setRefreshingId(id);
    try {
      const latest = await checkContainer(id);
      if (latest === null) toast.error("Could not find a latest tag");
      else toast.success(`Latest tag: ${latest}`);
    } catch {
      toast.error("Update check failed");
    } finally {
      setRefreshingId(null);
      onAdded();
    }
  };

  const del = async (id: number) => {
    await deleteContainer(id);
    toast.success("Container removed");
    onAdded();
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add container</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Add container</DialogTitle></DialogHeader>
          <AddContainerForm onAdd={async (c) => {
            await addContainer(projectId, c);
            toast.success("Container added");
            onAdded();
          }} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      {containers.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No containers added yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Tag</TableHead>
              <TableHead>Latest</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {containers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.image}</TableCell>
                <TableCell><Badge variant="outline">{c.tag}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{c.latestVersion ?? "—"}</TableCell>
                <TableCell>{statusCell(c)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label="Check update" onClick={() => refresh(c.id)} disabled={refreshingId === c.id}>
                      <RefreshCw className={refreshingId === c.id ? "animate-spin" : "h-4 w-4"} />
                    </Button>
                    <EditContainerButton c={c} onDone={onAdded} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete container?</AlertDialogTitle>
                          <AlertDialogDescription>“{imageLabel(c.image, c.tag)}” will be removed from this project.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del(c.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function statusCell(c: Container) {
  if (c.isUpdatable && c.latestVersion) {
    return <Badge variant="warning">Update available ({c.latestVersion})</Badge>;
  }
  if (c.latestVersion) {
    return <Badge variant="success">Up to date</Badge>;
  }
  return <Badge variant="secondary">Not checked</Badge>;
}

function AddContainerForm({
  onAdd,
  onDone,
}: {
  onAdd: (c: { image: string; tag: string; githubRepo?: string | null }) => void;
  onDone: () => void;
}) {
  const [image, setImage] = useState("");
  const [tag, setTag] = useState("");
  const [githubRepo, setGithubRepo] = useState("");

  const isGhcr = image.trim().toLowerCase().startsWith("ghcr.io/");

  const submit = async () => {
    if (!image.trim()) return;
    await onAdd({
      image: image.trim(),
      tag: tag.trim() || "latest",
      githubRepo: isGhcr ? githubRepo : null,
    });
    onDone();
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Image</Label>
        <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="nginx or ghcr.io/owner/app" autoFocus />
      </div>
      <div className="space-y-2">
        <Label>Tag</Label>
        <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="latest" />
      </div>
      {isGhcr && (
        <div className="space-y-2">
          <Label>GitHub repo <span className="text-muted-foreground">(optional — ghcr.io images only)</span></Label>
          <Input value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} placeholder="immich-app/immich" />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button onClick={submit} disabled={!image.trim()}>Add</Button>
      </div>
    </div>
  );
}

function EditContainerButton({ c, onDone }: { c: Container; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <EditContainerDialog c={c} onOpenChange={setOpen} onDone={() => { onDone(); setOpen(false); }} />
    </Dialog>
  );
}

function EditContainerDialog({
  c,
  onOpenChange,
  onDone,
}: {
  c: Container;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [image, setImage] = useState(c.image);
  const [tag, setTag] = useState(c.tag);
  const [githubRepo, setGithubRepo] = useState(c.githubRepo ?? "");

  const isGhcr = image.trim().toLowerCase().startsWith("ghcr.io/");

  const submit = async () => {
    if (!image.trim()) return;
    await updateContainer(c.id, {
      image: image.trim(),
      tag: tag.trim() || "latest",
      githubRepo: isGhcr ? githubRepo : null,
    });
    toast.success("Container updated");
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Edit container</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Image</Label>
          <Input value={image} onChange={(e) => setImage(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Tag</Label>
          <Input value={tag} onChange={(e) => setTag(e.target.value)} />
        </div>
        {(isGhcr || Boolean(c.githubRepo)) && (
          <div className="space-y-2">
            <Label>GitHub repo <span className="text-muted-foreground">(optional — ghcr.io images only)</span></Label>
            <Input value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} placeholder="immich-app/immich" />
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={submit} disabled={!image.trim()}>Save</Button>
      </div>
    </DialogContent>
  );
}
