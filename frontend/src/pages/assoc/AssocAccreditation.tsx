import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import jsQR from 'jsqr';
import { useAssocAuth } from '../../contexts/AssocAuthContext';
import { assocApi, AccreditationResult, Accreditation } from '../../lib/assocApi';

type ScanState = 'idle' | 'scanning' | 'processing' | 'result';

function ResultCard({
  result,
  onNext,
}: {
  result: AccreditationResult;
  onNext: () => void;
}) {
  const player = result.player;

  const configs = {
    ACCREDITED: {
      bg: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.3)',
      icon: '✓',
      iconColor: '#22c55e',
      iconBg: 'rgba(34,197,94,0.15)',
      title: 'HABILITADO',
      titleColor: '#22c55e',
      subtitle: 'ACREDITADO',
    },
    ALREADY_ACCREDITED: {
      bg: 'rgba(251,191,36,0.08)',
      border: 'rgba(251,191,36,0.25)',
      icon: '⚠',
      iconColor: '#fbbf24',
      iconBg: 'rgba(251,191,36,0.12)',
      title: 'YA ACREDITADO',
      titleColor: '#fbbf24',
      subtitle: null,
    },
    NOT_ELIGIBLE: {
      bg: 'rgba(248,113,113,0.08)',
      border: 'rgba(248,113,113,0.25)',
      icon: '✕',
      iconColor: '#f87171',
      iconBg: 'rgba(248,113,113,0.12)',
      title: 'NO HABILITADO',
      titleColor: '#f87171',
      subtitle: null,
    },
    NOT_IN_MATCH: {
      bg: 'rgba(248,113,113,0.08)',
      border: 'rgba(248,113,113,0.25)',
      icon: '✕',
      iconColor: '#f87171',
      iconBg: 'rgba(248,113,113,0.12)',
      title: 'NO PERTENECE A ESTE PARTIDO',
      titleColor: '#f87171',
      subtitle: null,
    },
    INVALID_QR: {
      bg: 'rgba(248,113,113,0.08)',
      border: 'rgba(248,113,113,0.25)',
      icon: '✕',
      iconColor: '#f87171',
      iconBg: 'rgba(248,113,113,0.12)',
      title: 'CARNET NO VÁLIDO',
      titleColor: '#f87171',
      subtitle: null,
    },
    PLAYER_NOT_FOUND: {
      bg: 'rgba(248,113,113,0.08)',
      border: 'rgba(248,113,113,0.25)',
      icon: '✕',
      iconColor: '#f87171',
      iconBg: 'rgba(248,113,113,0.12)',
      title: 'JUGADOR NO ENCONTRADO',
      titleColor: '#f87171',
      subtitle: null,
    },
    ACCREDITATION_CLOSED: {
      bg: 'rgba(156,163,175,0.08)',
      border: 'rgba(156,163,175,0.2)',
      icon: '⊘',
      iconColor: '#9ca3af',
      iconBg: 'rgba(156,163,175,0.1)',
      title: 'ACREDITACIÓN CERRADA',
      titleColor: '#9ca3af',
      subtitle: null,
    },
  };

  const c = configs[result.result] || configs.INVALID_QR;
  const time = result.accreditedAt
    ? new Date(result.accreditedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      className="rounded-2xl p-6 w-full max-w-sm mx-auto"
      style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}
    >
      {/* Icon */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl"
        style={{ backgroundColor: c.iconBg, color: c.iconColor }}
      >
        {c.icon}
      </div>

      {/* Player info */}
      {player && (
        <div className="text-center mb-4">
          {player.photoUrl ? (
            <img
              src={player.photoUrl}
              alt=""
              className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-2"
              style={{ borderColor: c.iconColor }}
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold text-white border-2"
              style={{ backgroundColor: 'var(--brand-surface)', borderColor: c.iconColor }}
            >
              {(player.firstName[0] + player.lastName[0]).toUpperCase()}
            </div>
          )}
          <p className="text-xl font-bold text-white">
            {player.firstName} {player.lastName}
          </p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--brand-muted)' }}>
            {player.teamName}
          </p>
        </div>
      )}

      {/* Status */}
      <div className="text-center">
        <p className="font-display text-lg tracking-widest font-bold" style={{ color: c.titleColor }}>
          {c.title}
        </p>
        {c.subtitle && (
          <p className="font-display text-sm tracking-wider mt-0.5" style={{ color: c.titleColor }}>
            {c.subtitle}
          </p>
        )}
        {time && (
          <p className="text-sm mt-2" style={{ color: 'var(--brand-muted)' }}>{time}</p>
        )}
        {result.reason && (
          <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }}>{result.reason}</p>
        )}
      </div>

      {/* Next button */}
      <button
        onClick={onNext}
        className="w-full mt-5 py-3 rounded-xl font-display tracking-widest text-white text-sm transition-all active:scale-95"
        style={{ backgroundColor: 'var(--brand-primary)' }}
      >
        ESCANEAR SIGUIENTE
      </button>
    </div>
  );
}

export default function AssocAccreditation() {
  const { user } = useAssocAuth();
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [result, setResult] = useState<AccreditationResult | null>(null);
  const [accreditations, setAccreditations] = useState<Accreditation[]>([]);
  const [matchInfo, setMatchInfo] = useState<{ home: string; away: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const processingRef = useRef(false);

  if (!user) {
    navigate('/assoc/login', { replace: true });
    return null;
  }

  const fetchAccreditations = useCallback(async () => {
    if (!matchId) return;
    try {
      const data = await assocApi.listAccreditations(matchId);
      setAccreditations(data);
    } catch {
      // silent — counts just won't update
    }
  }, [matchId]);

  useEffect(() => {
    assocApi.listMatches().then(matches => {
      const m = matches.find(m => m.id === matchId);
      if (m) {
        setMatchInfo({ home: m.home_team_name, away: m.away_team_name });
      }
    }).catch(() => {});
    fetchAccreditations();
  }, [matchId, fetchAccreditations]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const handleQr = useCallback(async (qrData: string) => {
    if (!matchId) return;
    setScanState('processing');
    try {
      const res = await assocApi.accredit(matchId, qrData);
      setResult(res);
      setScanState('result');
      fetchAccreditations();
    } catch {
      setResult({ result: 'INVALID_QR' });
      setScanState('result');
    }
  }, [matchId, fetchAccreditations]);

  const startCamera = useCallback(async () => {
    setScanState('scanning');
    processingRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const tick = () => {
        if (processingRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        if (video.readyState >= video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, canvas.width, canvas.height);
          if (code?.data) {
            processingRef.current = true;
            stopCamera();
            handleQr(code.data);
            return;
          }
        }
        animFrameRef.current = requestAnimationFrame(tick);
      };

      animFrameRef.current = requestAnimationFrame(tick);
    } catch {
      setScanState('idle');
    }
  }, [stopCamera, handleQr]);

  const handleNext = () => {
    setResult(null);
    setScanState('idle');
  };

  useEffect(() => () => stopCamera(), [stopCamera]);

  const homeCount = matchInfo
    ? accreditations.filter(a => a.team_name === matchInfo.home).length
    : 0;
  const awayCount = matchInfo
    ? accreditations.filter(a => a.team_name === matchInfo.away).length
    : 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--brand-bg)' }}>
      {/* Header */}
      <div
        className="px-5 pt-safe-top pb-4 flex-shrink-0"
        style={{ backgroundColor: 'var(--brand-surface)', borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}
      >
        <div className="flex items-start justify-between mb-3">
          <button
            onClick={() => { stopCamera(); navigate('/assoc/matches'); }}
            className="text-sm active:opacity-70 flex items-center gap-1 mt-0.5"
            style={{ color: 'var(--brand-muted)' }}
          >
            ← Partidos
          </button>
          <button
            onClick={() => navigate(`/assoc/matches/${matchId}/accredited`)}
            className="text-xs px-3 py-1.5 rounded-lg active:opacity-70"
            style={{ color: 'var(--brand-muted)', backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            Ver acreditados
          </button>
        </div>

        {matchInfo && (
          <div className="text-center">
            <p className="font-display text-white text-base uppercase tracking-wide">
              {matchInfo.home} <span style={{ color: 'var(--brand-muted)' }}>vs</span> {matchInfo.away}
            </p>
            <p className="text-xs mt-1 font-semibold" style={{ color: '#22c55e' }}>
              ● ACREDITACIÓN ABIERTA
            </p>
          </div>
        )}

        {/* Counts */}
        <div className="flex justify-around mt-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{homeCount}</p>
            <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{matchInfo?.home ?? 'Local'}</p>
          </div>
          <div className="w-px" style={{ backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.15)' }} />
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{awayCount}</p>
            <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{matchInfo?.away ?? 'Visitante'}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-5">
        {scanState === 'idle' && (
          <div className="text-center">
            <div
              className="w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: 'var(--brand-surface)' }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--brand-muted)" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M9 9h1v1H9V9zm4 0h1v1h-1V9zm4 0h1v1h-1V9zM9 13h1v1H9v-1zm4 0h1v1h-1v-1zm4 0h1v1h-1v-1zM9 17h1v1H9v-1zm4 0h1v1h-1v-1zm4 0h1v1h-1v-1z" />
              </svg>
            </div>
            <button
              onClick={startCamera}
              className="px-8 py-4 rounded-2xl font-display tracking-widest text-white text-base transition-all active:scale-95"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              ESCANEAR JUGADOR
            </button>
          </div>
        )}

        {(scanState === 'scanning' || scanState === 'processing') && (
          <div className="w-full max-w-sm">
            <div className="relative rounded-2xl overflow-hidden aspect-square bg-black">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Scanner overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-56 h-56 border-2 border-white/60 rounded-2xl" />
              </div>
              {scanState === 'processing' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <p className="text-center text-sm mt-4" style={{ color: 'var(--brand-muted)' }}>
              {scanState === 'scanning' ? 'Apuntá al carnet del jugador' : 'Validando…'}
            </p>
          </div>
        )}

        {scanState === 'result' && result && (
          <ResultCard result={result} onNext={handleNext} />
        )}
      </div>
    </div>
  );
}
