import React, { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function ImageUpload({ value, onChange, label = "Upload Logo" }) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const mutation = useMutation({
    mutationFn: (file) => {
        // This is a mock progress, in a real scenario you would get this from the upload event
        setIsUploading(true);
        setProgress(0);
        const timer = setInterval(() => {
            setProgress(oldProgress => {
                if (oldProgress >= 90) {
                    return oldProgress;
                }
                return oldProgress + 10;
            });
        }, 200);

        return base44.integrations.Core.UploadFile({ file }).finally(() => {
             clearInterval(timer);
             setProgress(100);
        });
    },
    onSuccess: (data) => {
      onChange(data.file_url);
      setTimeout(() => setIsUploading(false), 500);
    },
    onError: () => {
        setIsUploading(false);
    }
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      mutation.mutate(file);
    }
  };

  const handleRemove = () => {
    onChange('');
  };

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-md border border-dashed flex items-center justify-center bg-slate-50">
          {value ? (
            <img src={value} alt="logo" className="w-full h-full object-contain rounded-md" />
          ) : (
            <ImageIcon className="w-8 h-8 text-slate-400" />
          )}
        </div>
        <div className="flex-1">
          {isUploading ? (
             <div className="space-y-1">
                <p className="text-sm text-slate-600">Uploading...</p>
                <Progress value={progress} className="w-full" />
             </div>
          ) : value ? (
            <Button size="sm" variant="outline" onClick={handleRemove}>
              <X className="w-4 h-4 mr-2" /> Remove
            </Button>
          ) : (
            <>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current.click()}>
                <Upload className="w-4 h-4 mr-2" /> Upload
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}