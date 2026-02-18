// ============================================================================
// TreatmentModal — Formulário de registro de tratamento (Careportal)
// Suporta: Meal Bolus, Correction Bolus, Carb Correction, BG Check, Note
// ============================================================================

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { createTreatment } from '../../lib/api';
import { useDashboardStore } from '../../stores/dashboardStore';
import { unitLabel, fromDisplayUnit } from '../../lib/glucose';

// ---- Definição dos tipos de evento ----------------------------------------

export const EVENT_TYPES = [
  { value: 'Meal Bolus',        label: 'Refeição + Bolus' },
  { value: 'Correction Bolus',  label: 'Bolus de Correção' },
  { value: 'Carb Correction',   label: 'Correção de Carbos' },
  { value: 'BG Check',          label: 'Leitura de Glicose' },
  { value: 'Note',              label: 'Anotação' },
] as const;

type EventTypeValue = typeof EVENT_TYPES[number]['value'];

interface FieldConfig {
  insulin?: boolean;
  carbs?: boolean;
  glucose?: boolean;
  protein?: boolean;
  fat?: boolean;
  notes?: boolean;
  // required subsets
  insulinRequired?: boolean;
  carbsRequired?: boolean;
  glucoseRequired?: boolean;
  notesRequired?: boolean;
}

const FIELD_CONFIG: Record<EventTypeValue, FieldConfig> = {
  'Meal Bolus':       { insulin: true, insulinRequired: true, carbs: true, carbsRequired: true, glucose: true, protein: true, fat: true, notes: true },
  'Correction Bolus': { insulin: true, insulinRequired: true, glucose: true, notes: true },
  'Carb Correction':  { carbs: true, carbsRequired: true, glucose: true, notes: true },
  'BG Check':         { glucose: true, glucoseRequired: true, notes: true },
  'Note':             { notes: true, notesRequired: true },
};

// ---- Helpers ----------------------------------------------------------------

function nowDatetimeLocal(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  // format: YYYY-MM-DDTHH:mm
  return now.toISOString().slice(0, 16);
}

// ---- Props ------------------------------------------------------------------

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

// ---- Component --------------------------------------------------------------

export function TreatmentModal({ onClose, onSuccess }: Props) {
  const { unit } = useDashboardStore();
  const ul = unitLabel(unit);

  const [eventType, setEventType] = useState<EventTypeValue>('Meal Bolus');
  const [datetimeLocal, setDatetimeLocal] = useState(nowDatetimeLocal());
  const [insulin, setInsulin]   = useState('');
  const [carbs, setCarbs]       = useState('');
  const [glucose, setGlucose]   = useState('');
  const [protein, setProtein]   = useState('');
  const [fat, setFat]           = useState('');
  const [notes, setNotes]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState<string[]>([]);

  const cfg = FIELD_CONFIG[eventType];

  function resetFields() {
    setInsulin(''); setCarbs(''); setGlucose('');
    setProtein(''); setFat(''); setNotes('');
    setErrors([]);
  }

  function handleEventTypeChange(v: EventTypeValue) {
    setEventType(v);
    resetFields();
  }

  function validate(): boolean {
    const errs: string[] = [];
    if (cfg.insulinRequired && !insulin)  errs.push('Insulina é obrigatória.');
    if (cfg.carbsRequired   && !carbs)    errs.push('Carbos são obrigatórios.');
    if (cfg.glucoseRequired && !glucose)  errs.push('Glicose é obrigatória.');
    if (cfg.notesRequired   && !notes.trim()) errs.push('Texto da anotação é obrigatório.');
    setErrors(errs);
    return errs.length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setErrors([]);

    try {
      // Build created_at from the datetime-local input (treat as local time)
      const created_at = new Date(datetimeLocal).toISOString();

      const payload: Record<string, unknown> = { eventType, created_at };

      if (insulin)  payload.insulin = parseFloat(insulin);
      if (carbs)    payload.carbs   = parseFloat(carbs);
      if (glucose)  payload.glucose = fromDisplayUnit(parseFloat(glucose), unit);
      if (protein)  payload.protein = parseFloat(protein);
      if (fat)      payload.fat     = parseFloat(fat);
      if (notes)    payload.notes   = notes.trim();

      await createTreatment(payload as any);
      onSuccess();
      onClose();
    } catch {
      setErrors(['Erro ao salvar tratamento. Tente novamente.']);
      setSaving(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal */}
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Registrar Tratamento</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Tipo de evento */}
          <div className="space-y-1.5">
            <Label htmlFor="eventType">Tipo</Label>
            <select
              id="eventType"
              value={eventType}
              onChange={(e) => handleEventTypeChange(e.target.value as EventTypeValue)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Data e hora */}
          <div className="space-y-1.5">
            <Label htmlFor="datetime">Data / Hora</Label>
            <Input
              id="datetime"
              type="datetime-local"
              value={datetimeLocal}
              onChange={(e) => setDatetimeLocal(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Insulina */}
          {cfg.insulin && (
            <div className="space-y-1.5">
              <Label htmlFor="insulin">
                Insulina{cfg.insulinRequired && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <div className="relative">
                <Input
                  id="insulin"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0"
                  value={insulin}
                  onChange={(e) => setInsulin(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">U</span>
              </div>
            </div>
          )}

          {/* Carbos */}
          {cfg.carbs && (
            <div className="space-y-1.5">
              <Label htmlFor="carbs">
                Carboidratos{cfg.carbsRequired && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <div className="relative">
                <Input
                  id="carbs"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">g</span>
              </div>
            </div>
          )}

          {/* Glicose */}
          {cfg.glucose && (
            <div className="space-y-1.5">
              <Label htmlFor="glucose">
                Glicose{cfg.glucoseRequired && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <div className="relative">
                <Input
                  id="glucose"
                  type="number"
                  min="0"
                  step={unit === 'mmol' ? '0.1' : '1'}
                  placeholder="0"
                  value={glucose}
                  onChange={(e) => setGlucose(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{ul}</span>
              </div>
            </div>
          )}

          {/* Proteína e Gordura — linha dupla */}
          {(cfg.protein || cfg.fat) && (
            <div className="grid grid-cols-2 gap-3">
              {cfg.protein && (
                <div className="space-y-1.5">
                  <Label htmlFor="protein">Proteína</Label>
                  <div className="relative">
                    <Input
                      id="protein"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={protein}
                      onChange={(e) => setProtein(e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">g</span>
                  </div>
                </div>
              )}
              {cfg.fat && (
                <div className="space-y-1.5">
                  <Label htmlFor="fat">Gordura</Label>
                  <div className="relative">
                    <Input
                      id="fat"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={fat}
                      onChange={(e) => setFat(e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">g</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          {cfg.notes && (
            <div className="space-y-1.5">
              <Label htmlFor="notes">
                {eventType === 'Note' ? (
                  <>Anotação<span className="text-destructive ml-0.5">*</span></>
                ) : 'Notas'}
              </Label>
              <textarea
                id="notes"
                rows={2}
                placeholder={eventType === 'Note' ? 'Descreva o evento…' : 'Observações opcionais…'}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
          )}

          {/* Erros */}
          {errors.length > 0 && (
            <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive space-y-0.5">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Salvando…' : 'Registrar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
