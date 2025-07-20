import { Volume2 } from "lucide-react";
import { Url } from "url";

interface AudioFileDisplayProps {
  fileUrl: string;
  fileName: string;
}

export function AudioFileDisplay({ fileUrl, fileName }: AudioFileDisplayProps) {
  return (
    <div className="relative p-3 rounded-lg border bg-white dark:bg-gray-900 shadow-sm max-w-fit">
      <div className="absolute top-2 right-2 p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30">
        <Volume2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
      </div>

      <audio src={fileUrl} className="hidden">
        Your browser does not support the audio element.
      </audio>

      <span className="text-sm text-gray-900 dark:text-gray-100 font-medium pr-8 block truncate max-w-[200px]">
        {fileName}
      </span>
    </div>
  );
}
