// ============================================================================
// SettingsPage - User-configurable settings
// ============================================================================

import { useState } from 'react';
import { useDashboardStore } from '../stores/dashboardStore';
import { unitLabel } from '../lib/glucose';
import type { GlucoseUnit } from '../lib/glucose';
import { saveSettings } from '../lib/api';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { User, RefreshCw } from 'lucide-react';

const REFRESH_OPTIONS = [
  { value: 1,  label: '1 minuto' },
  { value: 2,  label: '2 minutos' },
  { value: 5,  label: '5 minutos' },
  { value: 10, label: '10 minutos' },
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
];

export function SettingsPage() {
  const {
    unit, setUnit,
    patientName, setPatientName,
    refreshInterval, setRefreshInterval,
  } = useDashboardStore();

  const [localName, setLocalName] = useState(patientName);
  const [saved, setSaved] = useState(false);

  function handleUnitChange(newUnit: GlucoseUnit) {
    setUnit(newUnit);
    saveSettings({ unit: newUnit }).catch(() => {});
  }

  function handleRefreshIntervalChange(minutes: number) {
    setRefreshInterval(minutes);
    saveSettings({ refreshInterval: minutes }).catch(() => {});
  }

  function handleSave() {
    const newName = localName.trim();
    setPatientName(newName);

    saveSettings({ unit, patientName: newName, refreshInterval }).catch(() => {});

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const ul = unitLabel(unit);

  return (
    <main className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personalize o dashboard. As alterações são salvas automaticamente no seu dispositivo.
          </p>
        </div>

        {/* ============ EXIBIÇÃO ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Exibição
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Patient name */}
            <div className="space-y-1.5">
              <Label htmlFor="patientName">Nome do paciente</Label>
              <Input
                id="patientName"
                placeholder="Ex: Diego"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                maxLength={40}
              />
              <p className="text-xs text-muted-foreground">
                Exibido no cabeçalho do dashboard.
              </p>
            </div>

            {/* Unit */}
            <div className="space-y-1.5">
              <Label>Unidade de glicose</Label>
              <div className="flex gap-2">
                <Button
                  variant={unit === 'mgdl' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleUnitChange('mgdl')}
                >
                  mg/dL
                </Button>
                <Button
                  variant={unit === 'mmol' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleUnitChange('mmol')}
                >
                  mmol/L
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Unidade atual: {ul}
              </p>
            </div>

            {/* Refresh interval */}
            <div className="space-y-1.5">
              <Label htmlFor="refreshInterval">
                <RefreshCw className="inline h-3.5 w-3.5 mr-1" />
                Atualização automática
              </Label>
              <Select
                id="refreshInterval"
                value={String(refreshInterval)}
                onChange={(e) => handleRefreshIntervalChange(Number(e.target.value))}
                className="max-w-[180px]"
              >
                {REFRESH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ============ ACTIONS ============ */}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} className="flex-1 sm:flex-none sm:min-w-[120px]">
            {saved ? '✓ Salvo!' : 'Salvar'}
          </Button>
        </div>
      </div>
    </main>
  );
}
