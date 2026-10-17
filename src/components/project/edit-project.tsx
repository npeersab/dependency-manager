"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { updateProject } from "@/lib/actions";
import { toast } from "sonner";

export function EditProject({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Reset the form whenever the dialog opens so a previous session's edits
  // don't leak into the next one. Dismissing via Esc or backdrop only flips
  // `open`, so the reset has to live in onOpenChange rather than in the Cancel
  // handler.
  const onOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setName(project.name);
      setDescription(project.description ?? "");
    }
    setOpen(nextOpen);
  };

  // Keep the name field from opening with a stray selection/focus.
  useEffect(() => {
    if (!open) return;
    const el = nameInputRef.current;
    if (el) {
      el.setSelectionRange(el.value.length, el.value.length);
      el.blur();
    }
  }, [open]);

  const cancel = () => {
    setName(project.name);
    setDescription(project.description ?? "");
    setOpen(false);
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }
    setSaving(true);
    try {
      await updateProject(project.id, { name: name.trim(), description: description.trim() || undefined });
      toast.success("Project saved");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Edit project</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl" autoFocus={false} onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Edit “{project.name}”</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input ref={nameInputRef} id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[56px]" />
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <DialogClose asChild>
            <Button variant="outline" onClick={cancel}>Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={saving || !name.trim()}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
