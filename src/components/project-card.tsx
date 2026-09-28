"use client";

import Link from "next/link";
import { MoreHorizontal, Trash2 } from "lucide-react";
import type { Project } from "@prisma/client";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { useRouter } from "next/navigation";
import { deleteProject } from "@/lib/actions";
import { toast } from "sonner";

export function ProjectCard({ project }: { project: Project & { _count: { dependencies: number; containers: number } } }) {
  const router = useRouter();
  const handleDelete = async () => {
    await deleteProject(project.id);
    toast.success("Project deleted");
    // Re-run the server components so the list reflects the removed project.
    router.refresh();
  };

  return (
    <Card className="group relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <Link href={`/projects/${project.id}`} className="group/link hover:underline">
          <CardTitle className="text-lg">{project.name}</CardTitle>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mt-2 -mr-2 opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/projects/${project.id}`}>View details</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{project.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>This removes the project and all of its dependencies and containers. This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent>
        {project.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{project.description}</p>}
        <div className="mt-4 flex items-center gap-2">
          <Badge variant="secondary">{project._count.dependencies} deps</Badge>
          <Badge variant="secondary">{project._count.containers} containers</Badge>
        </div>
      </CardContent>

      <CardFooter>
        <Button asChild className="w-full" variant="secondary">
          <Link href={`/projects/${project.id}`}>Open project</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
