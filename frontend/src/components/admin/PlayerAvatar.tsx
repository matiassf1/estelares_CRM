import { getInitials } from '../../utils/format';

interface Props {
  nombre: string;
  apellido: string;
  fotoUrl?: string | null;
  size?: number;
  /** Bordes redondeados en vez de círculo, para las tarjetas de mobile. */
  square?: boolean;
}

/**
 * La foto del jugador manda siempre. Las iniciales sobre gris son el fallback:
 * antes se pintaban con uno de siete colores por hash del nombre, lo que sobre
 * negro puro rompía la sobriedad del tema. Es también el motivo por el que
 * "sin foto de carnet" merece estar en los pendientes del Inicio.
 */
export default function PlayerAvatar({ nombre, apellido, fotoUrl, size = 36, square = false }: Props) {
  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden shrink-0 ${square ? 'rounded-xl' : 'rounded-full'}`}
      style={{
        width: size,
        height: size,
        backgroundColor: fotoUrl ? 'var(--brand-bg)' : 'var(--brand-surface-2)',
        border: '1px solid rgb(var(--brand-border-rgb) / 0.9)',
        color: '#C8C8C8',
        fontSize: Math.round(size * 0.32),
        fontWeight: 700,
      }}
    >
      {fotoUrl
        ? <img src={fotoUrl} alt="" className="w-full h-full object-cover" />
        : getInitials(apellido, nombre)}
    </span>
  );
}
