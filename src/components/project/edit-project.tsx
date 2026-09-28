"use client";

import { useRef, useState } from "react";
import type { Project } from "@prisma/client";
import type { DepType } from "@prisma/client";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { parsePackageJson } from "@/lib/parsers/packageJson";
import { parsePomXml } from "@/lib/parsers/pomXml";
import { parseDockerCompose } from "@/lib/parsers/dockerCompose";
import { updateProject, addMembers } from "@/lib/actions";
import { toast } from "sonner";

interface PendingDep {
  name: string;
  version: string;
  type: DepType;
}
interface PendingContainer {
  image: string;
  tag: string;
}

export function EditProject({ project }: { project: Project }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pendingDeps, setPendingDeps] = useState<PendingDep[]>([]);
  const [pendingContainers, setPendingContainers] = useState<PendingContainer[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Editing off</span>
        </div>
        <Button variant="outline" onClick={() => setEditing(true)}>
          Edit project
        </Button>
      </div>
    );
  }

  const handleFile = (file: File) => {
    const lower = file.name.toLowerCase();
    const kind = lower.endsWith(".json") ? "package.json" : lower.endsWith(".xml") ? "pom.xml" : "docker-compose.yml";
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      try {
        const parsed =
          kind === "package.json" ? parsePackageJson(content) : kind === "pom.xml" ? parsePomXml(content) : parseDockerCompose(content);
        setPendingDeps((prev) => {
          const next = [...prev];
          for (const d of parsed.dependencies) {
            if (!next.some((x) => x.name.toLowerCase() === d.name.toLowerCase())) next.push(d);
          }
          return next;
        });
        setPendingContainers((prev) => {
          const next = [...prev];
          for (const c of parsed.containers) {
            const key = `${c.image}:${c.tag}`;
            if (!next.some((x) => `${x.image}:${x.tag}` === key)) next.push(c);
          }
          return next;
        });
        toast.success(`Loaded ${parsed.dependencies.length + parsed.containers.length} member(s) from ${file.name}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to parse file");
      }
    };
    reader.readAsText(file);
  };

  const cancel = () => {
    setName(project.name);
    setDescription(project.description ?? "");
    setPendingDeps([]);
    setPendingContainers([]);
    setEditing(false);
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }
    setSaving(true);
    try {
      await updateProject(project.id, { name: name.trim(), description: description.trim() || undefined });
      if (pendingDeps.length || pendingContainers.length) {
        const stats = await addMembers(project.id, { dependencies: pendingDeps, containers: pendingContainers });
        const parts: string[] = [];
        if (stats.addedDependencies) parts.push(`${stats.addedDependencies} dep(s) added`);
        if (stats.updatedDependencies) parts.push(`${stats.updatedDependencies} dep(s) updated`);
        if (stats.addedContainers) parts.push(`${stats.addedContainers} container(s) added`);
        if (stats.updatedContainers) parts.push(`${stats.updatedContainers} container(s) updated`);
        toast.success(`Project saved — ${parts.join(", ")}`);
      } else {
        toast.success("Project saved");
      }
      setEditing(false);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-primary/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Editing “{project.name}”</span>
        <Switch checked={editing} onCheckedChange={setEditing} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-name">Name</Label>
          <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-desc">Description</Label>
          <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      {/* Upload in edit mode */}
      <div className="space-y-2">
        <Label>Upload files (adds members)</Label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={
            `flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors ` +
            (dragOver ? "border-primary bg-accent" : "border-input")
          }
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs">Drop pom.xml · package.json · docker-compose.yml</p>
          <input ref={fileInputRef} type="file" className="hidden" accept=".json,.xml,.yml,.yaml" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }} />
        </div>
      </div>

      {(pendingDeps.length > 0 || pendingContainers.length > 0) && (
        <div className="space-y-2 rounded-md bg-muted/50 p-3">
          <span className="text-xs font-medium">Pending from upload</span>
          <div className="flex flex-wrap gap-1.5">
            {pendingDeps.map((d, i) => (
              <span key={`d-${i}`} className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 text-xs">
                {d.name}@{d.version}
                <Button variant="ghost" size="icon" className="h-3.5 w-3.5" onClick={() => setPendingDeps((p) => p.filter((_, idx) => idx !== i))}>
                  <X className="h-3 w-3" />
                </Button>
              </span>
            ))}
            {pendingContainers.map((c, i) => (
              <span key={`c-${i}`} className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 text-xs">
                {c.image}:{c.tag}
                <Button variant="ghost" size="icon" className="h-3.5 w-3.5" onClick={() => setPendingContainers((p) => p.filter((_, idx) => idx !== i))}>
                  <X className="h-3 w-3" />
                </Button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={cancel}>Cancel</Button>
        <Button onClick={save} disabled={saving || !name.trim()}>Save changes</Button>
      </div>
    </div>
  );
}
