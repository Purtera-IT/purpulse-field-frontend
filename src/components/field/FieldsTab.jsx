import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Loader2, PenTool } from 'lucide-react';
import { toast } from 'sonner';
import SignoffCapture from './SignoffCapture';
import CloseoutPreview from './CloseoutPreview';
import { Separator } from '@/components/ui/separator';

export default function FieldsTab({ job }) {
  const fields = job?.fields_schema || [];
  const [values, setValues] = useState(
    Object.fromEntries(fields.map(f => [f.key, f.value || '']))
  );
  const [showSignoff, setShowSignoff] = useState(false);
  const [showCloseout, setShowCloseout] = useState(false);
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updatedFields = fields.map(f => ({ ...f, value: values[f.key] || '' }));
      await base44.entities.Job.update(job.id, { fields_schema: updatedFields });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Fields saved');
    },
  });

  const renderField = (field) => {
    const val = values[field.key] || '';
    const common = { className: 'rounded-xl' };

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            {...common}
            value={val}
            onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
            rows={3}
            className="rounded-xl resize-none"
          />
        );
      case 'select':
        return (
          <Select value={val} onValueChange={(v) => setValues({ ...values, [field.key]: v })}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'number':
        return (
          <Input
            {...common}
            type="number"
            value={val}
            onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
          />
        );
      default:
        return (
          <Input
            {...common}
            value={val}
            onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      {fields.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Closeout Fields</p>
          {fields.map(field => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-xs text-slate-600">
                {field.label || field.key}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </Label>
              {renderField(field)}
            </div>
          ))}
          <Button
            className="w-full rounded-xl bg-slate-900 hover:bg-slate-800"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Fields
          </Button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        {!showSignoff ? (
          <Button
            variant="outline"
            className="w-full rounded-xl h-12 border-dashed"
            onClick={() => setShowSignoff(true)}
          >
            <PenTool className="h-4 w-4 mr-2" />
            {job?.signoff_signer_name ? 'Re-capture Sign-Off' : 'Capture Sign-Off'}
          </Button>
        ) : (
          <SignoffCapture job={job} onComplete={() => setShowSignoff(false)} />
        )}

        {job?.signoff_signer_name && !showSignoff && (
          <div className="mt-3 p-3 bg-emerald-50 rounded-xl">
            <p className="text-xs text-emerald-700 font-medium">Sign-off captured</p>
            <p className="text-xs text-emerald-600">{job.signoff_signer_name} — {job.signoff_signer_title}</p>
          </div>
        )}
      </div>

      <Separator />

      <CloseoutPreview job={job} />
    </div>
  );
}