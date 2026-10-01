import { useQuery } from "@tanstack/react-query";
import { avatarSrc } from "@/lib/profiles";

export function PixelAvatar({ path, name, size = 48 }: { path: string | null; name: string; size?: number }) {
  const { data: src } = useQuery({
    queryKey: ["avatar", path],
    queryFn: () => avatarSrc(path),
    enabled: Boolean(path),
    staleTime: 30 * 60 * 1000,
  });
  return (
    <div
      className="pixel-inset flex shrink-0 items-center justify-center overflow-hidden bg-muted font-pixel text-primary"
      style={{ width: size, height: size, fontSize: size / 3 }}
    >
      {src ? (
        <img src={src} alt={`${name} avatar`} className="h-full w-full object-cover" style={{ imageRendering: "pixelated" }} />
      ) : (
        (name[0] ?? "?").toUpperCase()
      )}
    </div>
  );
}
