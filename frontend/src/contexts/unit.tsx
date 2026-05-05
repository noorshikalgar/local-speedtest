import { createContext, useContext, useState, type ReactNode } from 'react';
import type { SpeedUnit } from '@/lib/utils';

interface UnitContextType {
  unit: SpeedUnit;
  setUnit: (u: SpeedUnit) => void;
}

const UnitContext = createContext<UnitContextType>({ unit: 'Mbps', setUnit: () => {} });

export function UnitProvider({ children }: { children: ReactNode }) {
  const [unit, setUnitState] = useState<SpeedUnit>(() => {
    const stored = localStorage.getItem('sw_unit');
    return (stored === 'Mbps' || stored === 'MBps') ? stored : 'Mbps';
  });

  function setUnit(u: SpeedUnit) {
    localStorage.setItem('sw_unit', u);
    setUnitState(u);
  }

  return <UnitContext.Provider value={{ unit, setUnit }}>{children}</UnitContext.Provider>;
}

export const useUnit = () => useContext(UnitContext);
