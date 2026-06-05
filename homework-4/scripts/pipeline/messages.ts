export function buildUserMessage(
  parts: Array<{ type: string; name?: string; content: string }>,
): string {
  return parts
    .map(p => {
      const attrs = p.name ? ` name="${p.name}"` : '';
      return `<${p.type}${attrs}>\n${p.content}\n</${p.type}>`;
    })
    .join('\n\n');
}
