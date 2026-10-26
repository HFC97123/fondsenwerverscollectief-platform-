import React, { createContext, useContext, useState } from 'react';
const Ctx = createContext(null);
export const log = { overnemen: [] };
export function TestStore({ begin = {}, children }) {
  const [orgProfile, setP] = useState(begin);
  const [orgBronnen, setB] = useState({});
  const store = {
    orgProfile, orgBronnen,
    setOrgField: (k, v) => setP((c) => ({ ...c, [k]: v })),
    clearOrgField: () => {}, clearOrgProfile: () => {},
    overnemenOrgVelden: (velden, type, ref) => { log.overnemen.push({ velden, type, ref }); setP((c) => ({ ...c, ...velden })); setB((c) => ({ ...c, ...Object.fromEntries(Object.keys(velden).map((k) => [k, { type, ref }])) })); },
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
export const useKompas = () => useContext(Ctx);
