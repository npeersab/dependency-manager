import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";
import { NewProjectForm } from "@/components/project/new-project-form";

export const metadata = {
  title: "New Project",
};

export default function NewProjectPage() {
  return (
    <div className="mx-auto min-h-screen px-4 py-8 max-w-5xl">
      <Header
        cta={
          <Button variant="ghost" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Projects
            </Link>
          </Button>
        }
      />
      <div className="mt-6">
        <NewProjectForm />
      </div>
    </div>
  );
}
