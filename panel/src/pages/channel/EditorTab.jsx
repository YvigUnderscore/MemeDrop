// Onglet « Éditeur » — embarque l'éditeur web (/compose) pour ce channel.
// L'iframe est same-origin : elle récupère elle-même un token éditeur éphémère
// via le cookie de session panel (voir web-editor/api.js, mode panel).
export default function EditorTab({ channel }) {
  // Slash final : évite le 301 de serve-static (dont la réponse porte une CSP
  // restrictive qui casse le rendu du document dans l'iframe).
  const src = `/compose/?channel=${encodeURIComponent(channel.slug)}`;
  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-surface" style={{ height: 'calc(100vh - 230px)', minHeight: 520 }}>
      <iframe
        title="Meme editor"
        src={src}
        className="w-full h-full block"
        style={{ border: 0 }}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
