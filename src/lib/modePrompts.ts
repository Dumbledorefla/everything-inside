// Mode-specific system prompts and safe zone rules for the COS generation engine

export type OperationMode = "foundation" | "social" | "performance";

export const MODE_SYSTEM_PROMPTS: Record<OperationMode, string> = {
  foundation: `MODO: FUNDAÇÃO (Branding & Identidade)
OBJETIVO: Construção da alma visual do projeto.
DIRETRIZES:
- Priorize minimalismo, escalabilidade e formas puras.
- Ignore fundos complexos — foque na MARCA.
- Cores devem ser sólidas e reproduzíveis em qualquer mídia.
- Tipografia deve ser legível em tamanhos mínimos (favicon) e máximos (outdoor).
- Cada elemento deve funcionar isolado e em conjunto.
- Pense em versões: monocromática, negativa, reduzida.`,

  social: `MODO: SOCIAL (Conteúdo & Engajamento)
OBJETIVO: Operação diária de redes sociais — retenção e viralização.
DIRETRIZES:
- Priorize estética NATIVA das redes sociais (Instagram, TikTok, LinkedIn).
- Use tendências visuais atuais: gradientes suaves, tipografia bold, micro-animações.
- Composição otimizada para RETENÇÃO: ganchos visuais nos primeiros 0.5s de scroll.
- Cores vibrantes e alto contraste para feeds saturados.
- Texto deve ser legível mesmo em thumbnails de 150px.
- Considere que 80% do consumo é mobile.`,

  performance: `MODO: PERFORMANCE (Vendas & Anúncios)
OBJETIVO: Conversão, tráfego pago e vendas diretas.
DIRETRIZES:
- Priorize HIERARQUIA DE LEITURA: headline → benefício → CTA.
- Clareza TOTAL do produto — sem ambiguidade visual.
- Alto contraste e cores que geram urgência (vermelho, laranja, amarelo).
- Conformidade com "zonas mortas" das plataformas de ads (20% text rule).
- Composição que guia o olhar para o CTA.
- Inclua espaço para botões de plataforma (Comprar Agora, Saiba Mais).
- Copy direta: dor → solução → prova → ação.`,
};

export const MODE_SAFE_ZONES: Record<OperationMode, Record<string, string>> = {
  foundation: {
    "1:1": "Centralizar elemento principal. Margem mínima de 15% em todos os lados para respiração da marca.",
    "16:9": "Logo centralizado ou rule-of-thirds. Margem lateral de 10%.",
  },
  social: {
    "1:1": "Feed: elementos cruciais no centro. Margem de 5% para safe area do Instagram.",
    "4:5": "Feed vertical: headline no terço superior. CTA no terço inferior.",
    "9:16": "Stories: zona MORTA nos 250px superiores (perfil/nome) e 250px inferiores (barra de resposta). Conteúdo vital na zona central.",
  },
  performance: {
    "1:1": "Ads Feed: centralização absoluta ou diagonal para guiar olhar ao CTA. Texto máximo 20% da área.",
    "4:5": "Ads vertical: produto no centro, headline acima, CTA abaixo. Espaço para botão de plataforma nos 80px inferiores.",
    "9:16": "Ads Stories: mesmo safe zone de stories + espaço para swipe-up nos 200px inferiores.",
    "16:9": "Hero Banner: composição lateral. Objeto principal em 1 dos terços. 60% da imagem com respiro para sobreposição de texto no site/e-commerce.",
  },
};

export const MODE_PIECE_PROMPTS: Record<string, string> = {
  // Foundation
  logo: "Crie um conceito de logo: limpo, escalável, memorável. Deve funcionar em preto e branco e em tamanho mínimo de 32px.",
  palette: "Defina uma paleta de cores coesa: primária, secundária, accent e neutras. Justifique cada escolha com base no nicho.",
  typography: "Sugira uma combinação tipográfica: display (headlines), body (textos) e accent (CTAs). Justifique a escolha.",
  brand_manual: "Crie as diretrizes de uso da marca: espaçamento mínimo, versões permitidas, cores proibidas, tom de voz.",
  // Social
  highlight: "Crie uma capa de destaque para Instagram: ícone minimalista com fundo sólido na cor da marca.",
  // Performance
  hero_banner: "Crie um hero banner para site/e-commerce. Composição lateral, 60% de respiro para texto. Produto em destaque no terço direito.",
  ecommerce_banner: "Crie um banner de e-commerce: produto centralizado, fundo clean, badge de desconto, preço destacado.",
  lp_section: "Crie uma imagem para seção de landing page: visual que suporte sobreposição de texto. Alto contraste entre fundo e primeiro plano.",
};

export function buildModeContext(mode: OperationMode, pieceType: string, ratio: string): string {
  const systemPrompt = MODE_SYSTEM_PROMPTS[mode];
  const safeZone = MODE_SAFE_ZONES[mode]?.[ratio] || "";
  const piecePrompt = MODE_PIECE_PROMPTS[pieceType] || "";

  const parts = [systemPrompt];
  if (safeZone) parts.push(`\nZONA DE SEGURANÇA (${ratio}): ${safeZone}`);
  if (piecePrompt) parts.push(`\nINSTRUÇÃO DE PEÇA: ${piecePrompt}`);

  return parts.join("\n");
}
