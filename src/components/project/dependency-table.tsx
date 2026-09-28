"use client";

import { useState } from "react";
import type { Dependency } from "@prisma/client";
import type { DepType } from "@prisma/client";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { checkDependency, updateDependency, deleteDependency, addDependency } from "@/lib/actions";
import { toast } from "sonner";

export function DependencyTable({
  projectId,
  dependencies,
  onAdded,
}: {
  projectId: number;
  dependencies: Dependency[];
  onAdded: () => void;
}) {
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = async (id: number) => {
    setRefreshingId(id);
    try {
      const latest = await checkDependency(id);
      if (latest === null) toast.error("Could not find a latest version");
      else toast.success(`Latest version: ${latest}`);
    } catch {
      toast.error("Update check failed");
    } finally {
      setRefreshingId(null);
      onAdded();
    }
  };

  const del = async (id: number) => {
    await deleteDependency(id);
    toast.success("Dependency removed");
    onAdded();
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add dependency</Button>
        </DialogTrigger>
        <AddDependencyContent onAdd={async (dep) => {
          await addDependency(projectId, dep);
          toast.success("Dependency added");
          onAdded();
        }} onDone={() => setOpen(false)} />
      </Dialog>

      {dependencies.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No dependencies added yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Current</TableHead>
              <TableHead>Latest</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dependencies.map((dep) => (
              <TableRow key={dep.id}>
                <TableCell className="font-medium">{dep.name}</TableCell>
                <TableCell><Badge variant="outline">{dep.version}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{dep.latestVersion ?? "—"}</TableCell>
                <TableCell>{statusCell(dep)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label="Check update" onClick={() => refresh(dep.id)} disabled={refreshingId === dep.id}>
                      <RefreshCw className={refreshingId === dep.id ? "animate-spin" : "h-4 w-4"} />
                    </Button>
                    <EditDependencyButton dep={dep} onDone={onAdded} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete dependency?</AlertDialogTitle>
                          <AlertDialogDescription>“{dep.name}” will be removed from this project.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del(dep.id)}>Delete</AlertDialogAction>
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

function statusCell(dep: Dependency) {
  if (dep.isUpdatable && dep.latestVersion) {
    return <Badge variant="warning">Update available ({dep.latestVersion})</Badge>;
  }
  if (dep.latestVersion) {
    return <Badge variant="success">Up to date</Badge>;
  }
  return <Badge variant="secondary">Not checked</Badge>;
}

function AddDependencyContent({ onAdd, onDone }: { onAdd: (dep: { name: string; version: string; type: DepType }) => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [type, setType] = useState<DepType>("NPM");

  const submit = async () => {
    if (!name.trim()) return;
    await onAdd({ name: name.trim(), version: version.trim() || "unknown", type });
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add dependency</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as DepType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NPM">npm</SelectItem>
              <SelectItem value="MAVEN">Maven</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="lodash or org.apache:artifact" autoFocus />
        </div>
        <div className="space-y-2">
          <Label>Version</Label>
          <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.2.3" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button onClick={submit} disabled={!name.trim()}>Add</Button>
      </div>
    </DialogContent>
  );
}

function EditDependencyButton({ dep, onDone }: { dep: Dependency; onDone: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <EditDependencyDialog dep={dep} onOpenChange={setOpen} onDone={() => { onDone(); setOpen(false); }} />
    </Dialog>
  );
}

function EditDependencyDialog({
  dep,
  onOpenChange,
  onDone,
}: {
  dep: Dependency;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(dep.name);
  const [version, setVersion] = useState(dep.version);
  const [type, setType] = useState<DepType>(dep.type);

  const submit = async () => {
    if (!name.trim()) return;
    await updateDependency(dep.id, { name: name.trim(), version: version.trim() || dep.version, type });
    toast.success("Dependency updated");
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Edit dependency</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as DepType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NPM">npm</SelectItem>
              <SelectItem value="MAVEN">Maven</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Version</Label>
          <Input value={version} onChange={(e) => setVersion(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={submit} disabled={!name.trim()}>Save</Button>
      </div>
    </DialogContent>
  );
}
