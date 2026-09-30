const RP_COLORS = ["#E53935", "#8E24AA", "#1E88E5", "#00897B", "#F4511E", "#43A047", "#FB8C00", "#D81B60"];

function rpColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return RP_COLORS[Math.abs(h) % RP_COLORS.length];
}

function rpInit(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

interface ReportingChainProps {
  managerName: string;
  managerCode: string;
  managerDesig: string;
  managerAvatar: string | null;
  managerId: string;
  selfName: string;
  selfCode: string;
  selfDesig: string;
  selfAvatar: string | null;
  selfId: string;
  onNavigate: (id: string) => void;
}

export default function ReportingChain({
  managerName, managerCode, managerDesig, managerAvatar, managerId,
  selfName, selfCode, selfDesig, selfAvatar, selfId, onNavigate,
}: ReportingChainProps) {
  function ChainRow({
    name, code, desig, avatar, id, accent, label, isLast,
  }: {
    name: string;
    code: string;
    desig: string;
    avatar: string | null;
    id: string;
    accent: string;
    label: string;
    isLast?: boolean;
  }) {
    const col = rpColor(name);
    return (
      <div className="emp-chain-row">
        <div className="emp-chain-row__track">
          <div className="emp-chain-row__dot" style={{ background: accent, boxShadow: `0 0 0 2px ${accent}40` }} />
          {!isLast && <div className="emp-chain-row__line" style={{ background: `linear-gradient(to bottom, ${accent}60, var(--bms-border))` }} />}
        </div>
        <button type="button" className="emp-chain-row__card" onClick={() => onNavigate(id)}>
          <div className="emp-chain-row__accent" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}44)` }} />
          <div className="emp-chain-row__body">
            {avatar ? (
              <img src={avatar} alt={name} className="emp-chain-row__avatar" />
            ) : (
              <div className="emp-chain-row__avatar-fallback" style={{ background: col }}>
                {rpInit(name)}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="emp-chain-row__label" style={{ color: accent }}>{label}</div>
              <div className="emp-chain-row__name">{name}</div>
              {desig && <div className="emp-chain-row__desig">{desig}</div>}
            </div>
            {code && <code className="emp-chain-row__code">{code}</code>}
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="emp-chain">
      <ChainRow
        name={managerName}
        code={managerCode}
        desig={managerDesig}
        avatar={managerAvatar}
        id={managerId}
        accent="#7c3aed"
        label="Reports To"
      />
      <ChainRow
        name={selfName}
        code={selfCode}
        desig={selfDesig}
        avatar={selfAvatar}
        id={selfId}
        accent="#2563eb"
        label="You"
        isLast
      />
    </div>
  );
}
