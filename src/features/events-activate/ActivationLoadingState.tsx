import { Spinner } from "@/components/ui/spinner";

export function ActivationLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
      <Spinner className="size-8 text-primary" />
      <p className="text-sm font-medium text-muted-foreground">
        Memvalidasi token aktivasi akun Anda...
      </p>
    </div>
  );
}
