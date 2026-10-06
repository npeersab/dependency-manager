"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DepType } from "@prisma/client";
import { Upload, X, Plus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createProject } from "@/lib/actions";
import { parsePackageJson } from "@/lib/parsers/packageJson";
import { parsePomXml } from "@/lib/parsers/pomXml";
import { parseRequirementsTxt } from "@/lib/parsers/requirementsTxt";
import { parseDockerCompose } from "@/lib/parsers/dockerCompose";
import { toast } from "sonner";

interface Dep {
  name: string;
  version: string;
  type: DepType;
}
interface Container {
  image: string;
  tag: string;
}

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dependencies, setDependencies] = useState<Dep[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [mode, setMode] = useState("manual");
  const [uploadKind, setUploadKind] = useState<"package.json" | "pom.xml" | "requirements.txt" | "docker-compose.yml" | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // manual add forms
  const [depName, setDepName] = useState("");
  const [depVersion, setDepVersion] = useState("");
  const [depType, setDepType] = useState<DepType>("NPM");
  const [img, setImg] = useState("");
  const [tag, setTag] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = name.trim().length > 0;

  const addDependency = () => {
    if (!depName.trim()) return;
    setDependencies((prev) => {
      if (prev.some((d) => d.name.toLowerCase() === depName.trim().toLowerCase())) {
        toast.error("Dependency already added");
        return prev;
      }
      return [...prev, { name: depName.trim(), version: depVersion.trim() || "unknown", type: depType }];
    });
    setDepName("");
    setDepVersion("");
  };

  const addContainer = () => {
    if (!img.trim()) return;
    setContainers((prev) => {
      const key = `${img.trim()}:${tag.trim() || "latest"}`;
      if (prev.some((c) => `${c.image}:${c.tag}` === key)) {
        toast.error("Container already added");
        return prev;
      }
      return [...prev, { image: img.trim(), tag: tag.trim() || "latest" }];
    });
    setImg("");
    setTag("");
  };

  const handleFile = (file: File) => {
    const kind = uploadKind ?? detectKind(file.name);
    if (!kind) {
      setUploadKind(null);
      toast.error("Unsupported file. Upload package.json, pom.xml, requirements.txt, or docker-compose.yml.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      try {
        let parsed;
        if (kind === "package.json") parsed = parsePackageJson(content);
        else if (kind === "pom.xml") parsed = parsePomXml(content);
        else if (kind === "requirements.txt") parsed = parseRequirementsTxt(content);
        else parsed = parseDockerCompose(content);

        // Dedup against the accumulator (prev), not the closure snapshot, so
        // overlapping uploads processed before a re-render don't reintroduce
        // members already queued by an earlier upload in this batch.
        let added = 0;
        setDependencies((prev) => {
          const next = [...prev];
          for (const d of parsed.dependencies) {
            if (!next.some((x) => x.name.toLowerCase() === d.name.toLowerCase())) {
              next.push(d);
              added++;
            }
          }
          return next;
        });
        setContainers((prev) => {
          const next = [...prev];
          for (const c of parsed.containers) {
            const key = `${c.image}:${c.tag}`;
            if (!next.some((x) => `${x.image}:${x.tag}` === key)) {
              next.push(c);
              added++;
            }
          }
          return next;
        });
        toast.success(`Parsed ${added} new member(s) from ${file.name}`);
        setMode("manual"); // show the merged list
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to parse file");
      }
    };
    reader.readAsText(file);
  };

  const detectKind = (filename: string): NonNullable<typeof uploadKind> => {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".json")) return "package.json";
    if (lower.endsWith(".xml")) return "pom.xml";
    if (lower.endsWith(".txt")) return "requirements.txt";
    if (lower.includes("compose")) return "docker-compose.yml";
    return "docker-compose.yml";
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await createProject({ name: name.trim(), description: description.trim() || undefined, dependencies, containers });
    toast.success("Project created");
    router.push("/");
    router.refresh();
  };

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl">New Project</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Identity */}
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My service" autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Description</Label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional notes" />
        </div>

        {/* Mode */}
        <Tabs value={mode} onValueChange={setMode}>
          <TabsList>
            <TabsTrigger value="manual">Add manually</TabsTrigger>
            <TabsTrigger value="upload">Upload file</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-5 pt-4">
            {/* Dependency */}
            <div className="space-y-2">
              <Label className="items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Dependency</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={depType} onValueChange={(v) => setDepType(v as DepType)}>
                  <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NPM">npm</SelectItem>
                    <SelectItem value="MAVEN">Maven</SelectItem>
                    <SelectItem value="PYTHON">PyPI</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={depName} onChange={(e) => setDepName(e.target.value)} placeholder="name (lodash / g:a / flask)" />
                <Input value={depVersion} onChange={(e) => setDepVersion(e.target.value)} placeholder="version" className="w-28" />
                <Button onClick={addDependency} size="icon" aria-label="Add dependency"><Plus /></Button>
              </div>
            </div>

            {/* Container */}
            <div className="space-y-2">
              <Label className="items-center gap-1.5">Container</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={img} onChange={(e) => setImg(e.target.value)} placeholder="image (nginx / ghcr.io/o/app)" />
                <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="tag" className="w-28" />
                <Button onClick={addContainer} size="icon" aria-label="Add container"><Plus /></Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="pt-4">
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
                `flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ` +
                (dragOver ? "border-primary bg-accent" : "border-input")
              }
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Drop a file here, or click to browse</p>
                <p className="text-xs text-muted-foreground">package.json · pom.xml · requirements.txt · docker-compose.yml (not stored on server)</p>
              </div>
              <input ref={fileInputRef} type="file" className="hidden" accept=".json,.xml,.txt,.yml,.yaml" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Force file type:</span>
              <Select value={uploadKind ?? ""} onValueChange={(v) => setUploadKind(v as typeof uploadKind)}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Auto-detect" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="package.json">package.json</SelectItem>
                  <SelectItem value="pom.xml">pom.xml</SelectItem>
                  <SelectItem value="requirements.txt">requirements.txt</SelectItem>
                  <SelectItem value="docker-compose.yml">docker-compose.yml</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        {/* Working members */}
        {(dependencies.length > 0 || containers.length > 0) && (
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Members to add</h3>
              <Badge variant="secondary">{dependencies.length + containers.length}</Badge>
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {dependencies.map((d, i) => (
                <li key={`d-${i}`} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-sm">
                  <span>
                    <span className="font-medium">{d.name}</span> <span className="text-muted-foreground">{d.version}</span>
                    <Badge variant="secondary" className="ml-2">{d.type.toLowerCase()}</Badge>
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDependencies((p) => p.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
              {containers.map((c, i) => (
                <li key={`c-${i}`} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-sm">
                  <span>
                    <span className="font-medium">{c.image}</span> <span className="text-muted-foreground">{c.tag}</span>
                    <Badge variant="secondary" className="ml-2">container</Badge>
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setContainers((p) => p.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end gap-2 border-t pt-4">
        <Button variant="outline" asChild>
          <Link href="/">Cancel</Link>
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>Create project</Button>
      </CardFooter>
    </Card>
  );
}
