import type { AdminSection } from './AdminLayout';

export default function InicioPage({ onSection }: { onSection: (s: AdminSection) => void }) {
  void onSection;
  return null;
}
