"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NewProjectForm } from "./new-project-form";

interface NewProjectContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const NewProjectContext = createContext<NewProjectContextValue | null>(null);

export function NewProjectProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <NewProjectContext.Provider value={{ open, setOpen }}>
      {children}
    </NewProjectContext.Provider>
  );
}

export function useNewProject() {
  const ctx = useContext(NewProjectContext);
  if (!ctx) {
    throw new Error("useNewProject must be used within a NewProjectProvider");
  }
  return ctx;
}

export function NewProjectButton({ children }: { children?: ReactNode }) {
  const { setOpen } = useNewProject();
  return (
    <Button onClick={() => setOpen(true)}>
      {children ?? "+ New Project"}
    </Button>
  );
}

export function NewProjectModal() {
  const { open, setOpen } = useNewProject();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-auto">
        <NewProjectForm />
      </DialogContent>
    </Dialog>
  );
}
