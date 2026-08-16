import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
} from 'docx';
import mammoth from 'mammoth';
import { DetailedQuote, DetailedQuoteItem } from '../types';

/**
 * Formata valores numéricos para o padrão monetário brasileiro (R$ 0,00).
 */
export const formatCurrency = (val: number): string => {
  return (val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

/**
 * Formata data no formato DD/MM/AAAA.
 */
export const formatDateBR = (dateStr?: string): string => {
  if (!dateStr) return new Date().toLocaleDateString('pt-BR');
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
};

/**
 * Tradução amigável do tipo de item.
 */
export const getItemTypeLabel = (type?: DetailedQuoteItem['type']): string => {
  switch (type) {
    case 'labor': return 'Mão de Obra';
    case 'material': return 'Material';
    case 'service': return 'Serviço';
    case 'tax': return 'Taxa/Visita';
    default: return 'Geral';
  }
};

/**
 * Templates pré-configurados para gerar orçamentos rápidos em poucos cliques.
 */
export const QUOTE_TEMPLATES: {
  name: string;
  category: string;
  title: string;
  items: Omit<DetailedQuoteItem, 'id' | 'totalPrice'>[];
  estimatedDays: string;
  paymentTerms: string;
  warranty: string;
}[] = [
  {
    name: '⚡ Instalação / Troca de Disjuntores & Quadro',
    category: 'Eletricista',
    title: 'Substituição e Adequação de Quadro de Distribuição de Circuitos',
    items: [
      { description: 'Mão de obra para revisão e montagem do quadro elétrico', type: 'labor', quantity: 1, unit: 'serviço', unitPrice: 280 },
      { description: 'Disjuntor Bipolar Din 40A curva C (Padrão)', type: 'material', quantity: 1, unit: 'un', unitPrice: 45 },
      { description: 'Disjuntores Unipolares Din 16A/20A', type: 'material', quantity: 4, unit: 'un', unitPrice: 18 },
      { description: 'Barramento Pente Bifásico e Conectores', type: 'material', quantity: 1, unit: 'un', unitPrice: 35 },
    ],
    estimatedDays: '1 dia útil',
    paymentTerms: '50% de entrada (PIX) + 50% após testes finais',
    warranty: '90 dias sobre a mão de obra conforme Art. 26 do CDC',
  },
  {
    name: '💧 Troca de Torneira, Sifão e Reparo Hidráulico',
    category: 'Encanador',
    title: 'Manutenção Hidráulica e Troca de Metais Sanitários',
    items: [
      { description: 'Mão de obra de instalação e vedação de ponto de água', type: 'labor', quantity: 1, unit: 'serviço', unitPrice: 150 },
      { description: 'Sifão Universal Sanfonado Duplo / Simples', type: 'material', quantity: 1, unit: 'un', unitPrice: 28 },
      { description: 'Fita Veda-Rosca e Anéis de Vedação', type: 'material', quantity: 2, unit: 'un', unitPrice: 8 },
    ],
    estimatedDays: '3 a 4 horas',
    paymentTerms: 'Pagamento integral na conclusão do serviço (PIX / Cartão)',
    warranty: '90 dias de garantia contra vazamentos na instalação',
  },
  {
    name: '🎨 Pintura Residencial de Cômodo (Paredes + Teto)',
    category: 'Pintor',
    title: 'Pintura Completa de Sala / Quarto (Emassamento e 2 Demãos)',
    items: [
      { description: 'Mão de obra de lixamento, preparação e aplicação de 2 demãos', type: 'labor', quantity: 35, unit: 'm²', unitPrice: 18 },
      { description: 'Aplicação de massa corrida e correção de imperfeições', type: 'labor', quantity: 1, unit: 'serviço', unitPrice: 120 },
      { description: 'Tinta Acrílica Fosca Lavável Premium (Galão 3,6L)', type: 'material', quantity: 2, unit: 'gl', unitPrice: 95 },
      { description: 'Fita crepe profissional, lixas e lona de proteção', type: 'material', quantity: 1, unit: 'kit', unitPrice: 45 },
    ],
    estimatedDays: '2 dias úteis',
    paymentTerms: '40% início + 30% após emassamento + 30% entrega',
    warranty: '180 dias contra descascamento da película aplicada',
  },
  {
    name: '❄️ Instalação / Higienização de Ar-Condicionado Split',
    category: 'Climatização',
    title: 'Instalação Padrão de Ar Condicionado Split até 12.000 BTUs',
    items: [
      { description: 'Mão de obra de furação, fixação e vácuo na tubulação', type: 'labor', quantity: 1, unit: 'serviço', unitPrice: 380 },
      { description: 'Tubulação de Cobre Isolada e Cabo PP (até 3 metros)', type: 'material', quantity: 1, unit: 'kit', unitPrice: 140 },
      { description: 'Suporte metálico reforçado para unidade condensadora', type: 'material', quantity: 1, unit: 'par', unitPrice: 55 },
    ],
    estimatedDays: '1 dia útil (4 a 6 horas)',
    paymentTerms: '50% entrada + 50% após teste de refrigeração e dreno',
    warranty: '12 meses para serviços com tubulação e vácuo padrão',
  },
  {
    name: '🔨 Montagem de Móveis & Instalações Diversas',
    category: 'Montador / Handyman',
    title: 'Instalação de Suporte de TV, Painel e Cortinas',
    items: [
      { description: 'Fixação de Suporte Articulado e Passagem de Cabos', type: 'labor', quantity: 1, unit: 'serviço', unitPrice: 110 },
      { description: 'Instalação de Varão de Cortina / Trilho Suíço', type: 'labor', quantity: 2, unit: 'un', unitPrice: 45 },
      { description: 'Buchas de fixação especiais e parafusos reforçados', type: 'material', quantity: 1, unit: 'kit', unitPrice: 20 },
    ],
    estimatedDays: '2 a 3 horas',
    paymentTerms: 'Pagamento total após conferência de alinhamento com nível',
    warranty: '90 dias sobre a fixação',
  },
];

/**
 * GERAÇÃO DE PDF PROFISSIONAL COM JSPDF + AUTOTABLE
 */
export async function generateQuotePDF(quote: DetailedQuote): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 14;

  // Header Banner estilizado
  doc.setFillColor(30, 58, 138); // Blue 900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Marca / Logo Mestrio
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('MESTRIO', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(191, 219, 254);
  doc.text('Plataforma de Serviços Gerais e Manutenção Residencial', margin, 18);
  doc.text('www.mestrio.com.br', margin, 22);

  // Número do Orçamento e Data
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`ORÇAMENTO: ${quote.quoteNumber}`, pageWidth - margin, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(224, 231, 255);
  doc.text(`Emissão: ${formatDateBR(quote.createdAt)}`, pageWidth - margin, 18, { align: 'right' });
  doc.text(`Validade: ${quote.validityDays || '15 dias'}`, pageWidth - margin, 23, { align: 'right' });

  y = 36;

  // Título da Proposta
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(quote.title || 'Proposta Comercial de Prestação de Serviços', margin, y);

  if (quote.category) {
    doc.setFontSize(9);
    doc.setTextColor(79, 70, 229);
    doc.text(`Categoria: ${quote.category}`, margin, y + 5);
    y += 10;
  } else {
    y += 6;
  }

  // Caixa de Dados: Prestador & Cliente
  const boxWidth = (pageWidth - margin * 2 - 6) / 2;
  const boxHeight = 36;

  // Box Prestador
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, boxWidth, boxHeight, 2, 2, 'FD');

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DADOS DO PRESTADOR', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Nome: ${quote.providerName || 'Profissional Mestrio'}`, margin + 4, y + 12);
  if (quote.providerDocument) doc.text(`CPF/CNPJ: ${quote.providerDocument}`, margin + 4, y + 17);
  if (quote.providerPhone) doc.text(`Contato: ${quote.providerPhone}`, margin + 4, y + 22);
  if (quote.providerPixKey) doc.text(`Chave PIX: ${quote.providerPixKey}`, margin + 4, y + 27);
  if (quote.providerCity) doc.text(`Localidade: ${quote.providerCity}`, margin + 4, y + 32);

  // Box Cliente
  const clientBoxX = margin + boxWidth + 6;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(clientBoxX, y, boxWidth, boxHeight, 2, 2, 'FD');

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DADOS DO CLIENTE', clientBoxX + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Nome: ${quote.clientName || 'Cliente'}`, clientBoxX + 4, y + 12);
  if (quote.clientPhone) doc.text(`Telefone: ${quote.clientPhone}`, clientBoxX + 4, y + 17);
  if (quote.clientEmail) doc.text(`E-mail: ${quote.clientEmail}`, clientBoxX + 4, y + 22);
  if (quote.clientAddress) doc.text(`Endereço: ${quote.clientAddress}`, clientBoxX + 4, y + 27);
  if (quote.clientDocument) doc.text(`CPF/Doc: ${quote.clientDocument}`, clientBoxX + 4, y + 32);

  y += boxHeight + 8;

  // Descrição do Problema / Escopo (se houver)
  if (quote.problemDescription) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Escopo / Descrição das Necessidades:', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const splitDesc = doc.splitTextToSize(quote.problemDescription, pageWidth - margin * 2);
    doc.text(splitDesc, margin, y + 4);
    y += (splitDesc.length * 4) + 6;
  }

  // Tabela de Itens via AutoTable
  const tableData = (quote.items || []).map((item, idx) => [
    (idx + 1).toString(),
    item.description,
    getItemTypeLabel(item.type),
    item.quantity.toString(),
    item.unit || 'un',
    formatCurrency(item.unitPrice),
    formatCurrency(item.quantity * item.unitPrice),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Item / Descrição dos Serviços & Peças', 'Tipo', 'Qtd', 'Un.', 'Preço Unit.', 'Total']],
    body: tableData,
    margin: { left: margin, right: margin },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [37, 99, 235], // Blue 600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'right', cellWidth: 24 },
      6: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;
  let currentY = finalY;

  // Caixa de Resumo Financeiro (lado direito)
  const summaryWidth = 75;
  const summaryX = pageWidth - margin - summaryWidth;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(summaryX, currentY, summaryWidth, 34, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  doc.text('Subtotal:', summaryX + 4, currentY + 6);
  doc.text(formatCurrency(quote.subtotal), pageWidth - margin - 4, currentY + 6, { align: 'right' });

  let lineOffset = 12;
  if (quote.discountValue && quote.discountValue > 0) {
    const descText = quote.discountType === 'percent'
      ? `Desconto (${quote.discountValue}%):`
      : 'Desconto:';
    const discAmount = quote.discountType === 'percent'
      ? (quote.subtotal * quote.discountValue) / 100
      : quote.discountValue;
    doc.setTextColor(220, 38, 38);
    doc.text(descText, summaryX + 4, currentY + lineOffset);
    doc.text(`- ${formatCurrency(discAmount)}`, pageWidth - margin - 4, currentY + lineOffset, { align: 'right' });
    lineOffset += 6;
  }

  if (quote.travelFee && quote.travelFee > 0) {
    doc.setTextColor(71, 85, 105);
    doc.text('Taxa Deslocamento/Visita:', summaryX + 4, currentY + lineOffset);
    doc.text(`+ ${formatCurrency(quote.travelFee)}`, pageWidth - margin - 4, currentY + lineOffset, { align: 'right' });
    lineOffset += 6;
  }

  // Linha divisória e Total
  doc.setDrawColor(203, 213, 225);
  doc.line(summaryX + 2, currentY + 24, pageWidth - margin - 2, currentY + 24);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 138);
  doc.text('TOTAL:', summaryX + 4, currentY + 30);
  doc.text(formatCurrency(quote.totalAmount), pageWidth - margin - 4, currentY + 30, { align: 'right' });

  // Informações e Condições Comerciais (lado esquerdo)
  const termsWidth = summaryX - margin - 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('CONDIÇÕES GERAIS DE EXECUÇÃO:', margin, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  let termsY = currentY + 12;

  doc.text(`• Prazo de Execução: ${quote.estimatedDays || 'A combinar'}`, margin, termsY);
  termsY += 5;
  doc.text(`• Forma de Pagamento: ${quote.paymentTerms || '50% entrada + 50% conclusão'}`, margin, termsY);
  termsY += 5;
  if (quote.warranty) {
    doc.text(`• Garantia: ${quote.warranty}`, margin, termsY);
    termsY += 5;
  }
  if (quote.providerPixKey) {
    doc.text(`• Chave PIX p/ Pagamento: ${quote.providerPixKey}`, margin, termsY);
    termsY += 5;
  }
  if (quote.notes) {
    const splitNotes = doc.splitTextToSize(`• Obs: ${quote.notes}`, termsWidth);
    doc.text(splitNotes, margin, termsY);
    termsY += (splitNotes.length * 4);
  }

  // Espaço para Assinaturas
  const signY = Math.max(currentY + 40, termsY + 6);
  if (signY < 255) {
    const signBoxW = (pageWidth - margin * 2 - 20) / 2;

    // Assinatura do Prestador (se houver imagem)
    if (quote.providerSignature) {
      try {
        doc.addImage(quote.providerSignature, 'PNG', margin + (signBoxW / 2) - 20, signY - 2, 40, 15);
      } catch (e) {
        console.warn('Erro ao carregar assinatura do prestador', e);
      }
    }

    // Assinatura do Cliente (se houver imagem)
    if (quote.clientSignature) {
      try {
        doc.addImage(quote.clientSignature, 'PNG', margin + signBoxW + 20 + (signBoxW / 2) - 20, signY - 2, 40, 15);
      } catch (e) {
        console.warn('Erro ao carregar assinatura do cliente', e);
      }
    }

    doc.setDrawColor(148, 163, 184);
    doc.line(margin, signY + 15, margin + signBoxW, signY + 15);
    doc.line(margin + signBoxW + 20, signY + 15, pageWidth - margin, signY + 15);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`${quote.providerName || 'Prestador de Serviço'}`, margin + (signBoxW / 2), signY + 19, { align: 'center' });
    doc.text('Assinatura do Prestador', margin + (signBoxW / 2), signY + 23, { align: 'center' });

    doc.text(`${quote.clientName || 'Cliente / Contratante'}`, margin + signBoxW + 20 + (signBoxW / 2), signY + 19, { align: 'center' });
    doc.text(quote.clientSignature ? 'Assinado Digitalmente pelo Cliente' : 'De Acordo (Aprovação)', margin + signBoxW + 20 + (signBoxW / 2), signY + 23, { align: 'center' });
  }

  // Rodapé padrão
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Documento gerado eletronicamente via Mestrio - A plataforma oficial de serviços autônomos.', pageWidth / 2, pageHeight - 6, { align: 'center' });

  // Download do arquivo
  const safeClient = (quote.clientName || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Orcamento_${quote.quoteNumber || 'Mestrio'}_${safeClient}.pdf`;
  doc.save(filename);
}

/**
 * GERAÇÃO DE RECIBO DE PAGAMENTO & TERMO DE QUITAÇÃO (PDF)
 */
export async function generateReceiptPDF(quote: DetailedQuote, options?: {
  receiptNumber?: string;
  paidAt?: string;
  paymentMethod?: string;
  customNotes?: string;
}): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const receiptNum = options?.receiptNumber || quote.receiptNumber || `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const payDate = options?.paidAt || quote.paidAt || new Date().toISOString();
  const payMethod = options?.paymentMethod || quote.paymentMethod || 'PIX / Transferência';

  // Cabeçalho institucional verde/esmeralda (Quitação)
  doc.setFillColor(15, 118, 110); // Teal 700
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('RECIBO DE PAGAMENTO & QUITAÇÃO', margin, 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(204, 251, 241);
  doc.text('Comprovante oficial de quitação de serviços prestados e garantia legal', margin, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`Nº ${receiptNum}`, pageWidth - margin, 13, { align: 'right' });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data de Emissão: ${formatDateBR(payDate)}`, pageWidth - margin, 20, { align: 'right' });

  let y = 36;

  // Bloco de Identificação: Prestador & Pagador
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 36, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 118, 110);
  doc.text('EMITENTE / PRESTADOR:', margin + 4, y + 6);
  doc.text('PAGADOR / CLIENTE:', margin + (contentWidth / 2) + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8);

  // Prestador
  doc.text(`Nome: ${quote.providerName || 'Profissional Mestrio'}`, margin + 4, y + 12);
  if (quote.providerDocument) doc.text(`CPF/CNPJ: ${quote.providerDocument}`, margin + 4, y + 17);
  if (quote.providerPhone) doc.text(`Contato: ${quote.providerPhone}`, margin + 4, y + 22);
  if (quote.providerCity) doc.text(`Localidade: ${quote.providerCity}`, margin + 4, y + 27);

  // Cliente
  const col2X = margin + (contentWidth / 2) + 4;
  doc.text(`Nome: ${quote.clientName || 'Cliente'}`, col2X, y + 12);
  if (quote.clientDocument) doc.text(`CPF/CNPJ: ${quote.clientDocument}`, col2X, y + 17);
  if (quote.clientPhone) doc.text(`Telefone: ${quote.clientPhone}`, col2X, y + 22);
  if (quote.clientAddress) doc.text(`Endereço: ${quote.clientAddress}`, col2X, y + 27, { maxWidth: (contentWidth / 2) - 8 });

  y += 42;

  // Declaração Formal de Recebimento
  doc.setFillColor(240, 253, 244); // Green 50
  doc.setDrawColor(187, 247, 208); // Green 200
  doc.roundedRect(margin, y, contentWidth, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(22, 101, 52); // Green 800
  doc.text('DECLARAÇÃO DE RECEBIMENTO & QUITAÇÃO PLENA', margin + 4, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const declarationText = `Recebi(emos) de ${quote.clientName || 'Cliente'} a importância de ${formatCurrency(quote.totalAmount)}, referente à prestação dos serviços de "${quote.title || 'Serviços Profissionais'}" (Orçamento nº ${quote.quoteNumber}), dando plena, rasa e geral quitação pelos valores e serviços aqui especificados.`;
  const splitDec = doc.splitTextToSize(declarationText, contentWidth - 8);
  doc.text(splitDec, margin + 4, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 118, 110);
  doc.text(`Forma de Pagamento: ${payMethod} | Data da Liquidação: ${formatDateBR(payDate)}`, margin + 4, y + 27);

  y += 38;

  // Tabela Resumida dos Serviços Executados
  const tableData = (quote.items || []).map((item, idx) => [
    (idx + 1).toString(),
    item.description,
    getItemTypeLabel(item.type),
    `${item.quantity} ${item.unit || 'un'}`,
    formatCurrency(item.unitPrice),
    formatCurrency(item.quantity * item.unitPrice),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Discriminação do Serviço / Peças Concluídas', 'Tipo', 'Qtd.', 'Preço Unit.', 'Total Quitado']],
    body: tableData,
    margin: { left: margin, right: margin },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 118, 110], // Teal 700
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;
  let bottomY = finalY;

  // Bloco de Garantia e Termos Legais
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, bottomY, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 118, 110);
  doc.text('TERMO DE GARANTIA DO SERVIÇO EXECUTADO:', margin + 4, bottomY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const warrantyText = quote.warranty || 'Garantia legal de 90 (noventa) dias conforme preconiza o Artigo 26, inciso II do Código de Defesa do Consumidor (Lei 8.078/90) sobre a mão de obra empregada.';
  const splitWar = doc.splitTextToSize(warrantyText, contentWidth - 8);
  doc.text(splitWar, margin + 4, bottomY + 12);

  bottomY += 32;

  // Assinatura do Prestador no Recibo
  if (bottomY < 255) {
    const signBoxW = 70;
    const signX = (pageWidth / 2) - (signBoxW / 2);

    if (quote.providerSignature) {
      try {
        doc.addImage(quote.providerSignature, 'PNG', signX + (signBoxW / 2) - 20, bottomY - 4, 40, 15);
      } catch (e) {
        console.warn('Erro ao carregar assinatura no recibo', e);
      }
    }

    doc.setDrawColor(148, 163, 184);
    doc.line(signX, bottomY + 14, signX + signBoxW, bottomY + 14);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`${quote.providerName || 'Prestador de Serviço'}`, pageWidth / 2, bottomY + 18, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(quote.providerDocument ? `CPF/CNPJ: ${quote.providerDocument}` : 'Assinatura do Emitente', pageWidth / 2, bottomY + 22, { align: 'center' });
  }

  // Rodapé
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Recibo eletrônico autenticado gerado via Mestrio (www.mestrio.com.br)', pageWidth / 2, pageHeight - 6, { align: 'center' });

  // Download
  const safeClient = (quote.clientName || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Recibo_${receiptNum}_${safeClient}.pdf`;
  doc.save(filename);
}

/**
 * GERAÇÃO DE ARQUIVO DOCX (WORD EDITÁVEL)
 */
export async function generateQuoteDOCX(quote: DetailedQuote): Promise<void> {
  const tableRows: TableRow[] = [
    // Header da Tabela
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [new Paragraph({ text: '#', alignment: AlignmentType.CENTER })],
          width: { size: 500, type: WidthType.DXA },
          shading: { fill: '2563EB', type: ShadingType.CLEAR },
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Descrição do Item / Serviço', alignment: AlignmentType.LEFT })],
          width: { size: 4500, type: WidthType.DXA },
          shading: { fill: '2563EB', type: ShadingType.CLEAR },
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Tipo', alignment: AlignmentType.CENTER })],
          width: { size: 1200, type: WidthType.DXA },
          shading: { fill: '2563EB', type: ShadingType.CLEAR },
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Qtd', alignment: AlignmentType.CENTER })],
          width: { size: 800, type: WidthType.DXA },
          shading: { fill: '2563EB', type: ShadingType.CLEAR },
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Valor Unit.', alignment: AlignmentType.RIGHT })],
          width: { size: 1400, type: WidthType.DXA },
          shading: { fill: '2563EB', type: ShadingType.CLEAR },
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Total', alignment: AlignmentType.RIGHT })],
          width: { size: 1400, type: WidthType.DXA },
          shading: { fill: '2563EB', type: ShadingType.CLEAR },
        }),
      ],
    }),
  ];

  // Linhas de dados
  (quote.items || []).forEach((item, index) => {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: `${index + 1}`, alignment: AlignmentType.CENTER })],
            width: { size: 500, type: WidthType.DXA },
          }),
          new TableCell({
            children: [new Paragraph({ text: item.description, alignment: AlignmentType.LEFT })],
            width: { size: 4500, type: WidthType.DXA },
          }),
          new TableCell({
            children: [new Paragraph({ text: getItemTypeLabel(item.type), alignment: AlignmentType.CENTER })],
            width: { size: 1200, type: WidthType.DXA },
          }),
          new TableCell({
            children: [new Paragraph({ text: `${item.quantity} ${item.unit || 'un'}`, alignment: AlignmentType.CENTER })],
            width: { size: 800, type: WidthType.DXA },
          }),
          new TableCell({
            children: [new Paragraph({ text: formatCurrency(item.unitPrice), alignment: AlignmentType.RIGHT })],
            width: { size: 1400, type: WidthType.DXA },
          }),
          new TableCell({
            children: [new Paragraph({ text: formatCurrency(item.quantity * item.unitPrice), alignment: AlignmentType.RIGHT })],
            width: { size: 1400, type: WidthType.DXA },
          }),
        ],
      })
    );
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: 'MESTRIO - SERVIÇOS GERAIS EM DOMICÍLIO',
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.LEFT,
          }),
          new Paragraph({
            text: `PROPOSTA COMERCIAL / ORÇAMENTO: ${quote.quoteNumber}`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.LEFT,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Data de Emissão: ${formatDateBR(quote.createdAt)}  |  Validade: ${quote.validityDays || '15 dias'}`, italics: true }),
            ],
          }),
          new Paragraph({ text: '' }),

          // Dados do Prestador e Cliente
          new Paragraph({
            children: [
              new TextRun({ text: 'DADOS DO PRESTADOR:', bold: true }),
              new TextRun({ text: `\nNome: ${quote.providerName || 'Profissional'}` }),
              new TextRun({ text: quote.providerDocument ? `\nCPF/CNPJ: ${quote.providerDocument}` : '' }),
              new TextRun({ text: quote.providerPhone ? `\nTelefone/WhatsApp: ${quote.providerPhone}` : '' }),
              new TextRun({ text: quote.providerPixKey ? `\nChave PIX: ${quote.providerPixKey}` : '' }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({ text: 'DADOS DO CLIENTE:', bold: true }),
              new TextRun({ text: `\nNome: ${quote.clientName || 'Cliente'}` }),
              new TextRun({ text: quote.clientPhone ? `\nTelefone: ${quote.clientPhone}` : '' }),
              new TextRun({ text: quote.clientAddress ? `\nEndereço: ${quote.clientAddress}` : '' }),
            ],
          }),
          new Paragraph({ text: '' }),

          // Tabela
          new Paragraph({
            children: [new TextRun({ text: 'DISCRIMINAÇÃO DOS SERVIÇOS E MATERIAIS:', bold: true })],
          }),
          new Table({
            rows: tableRows,
            width: { size: 9800, type: WidthType.DXA },
          }),
          new Paragraph({ text: '' }),

          // Resumo Financeiro
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: `Subtotal: ${formatCurrency(quote.subtotal)}\n` }),
              quote.discountValue && quote.discountValue > 0
                ? new TextRun({ text: `Desconto: - ${formatCurrency(quote.discountType === 'percent' ? (quote.subtotal * quote.discountValue) / 100 : quote.discountValue)}\n`, color: 'DC2626' })
                : new TextRun({ text: '' }),
              quote.travelFee && quote.travelFee > 0
                ? new TextRun({ text: `Taxa Deslocamento: + ${formatCurrency(quote.travelFee)}\n` })
                : new TextRun({ text: '' }),
              new TextRun({ text: `VALOR TOTAL: ${formatCurrency(quote.totalAmount)}`, bold: true, size: 28, color: '1E3A8A' }),
            ],
          }),
          new Paragraph({ text: '' }),

          // Condições
          new Paragraph({
            children: [new TextRun({ text: 'CONDIÇÕES GERAIS:', bold: true })],
          }),
          new Paragraph({ text: `• Prazo de Execução: ${quote.estimatedDays || 'A combinar'}` }),
          new Paragraph({ text: `• Forma de Pagamento: ${quote.paymentTerms || '50% entrada + 50% entrega'}` }),
          new Paragraph({ text: `• Garantia: ${quote.warranty || '90 dias conforme Art. 26 do CDC'}` }),
          quote.notes ? new Paragraph({ text: `• Observações: ${quote.notes}` }) : new Paragraph({ text: '' }),

          new Paragraph({ text: '' }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: '__________________________________                __________________________________',
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: 'Assinatura do Prestador                                     Aprovação do Cliente (De Acordo)',
            alignment: AlignmentType.CENTER,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeClient = (quote.clientName || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Orcamento_${quote.quoteNumber || 'Mestrio'}_${safeClient}.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * IMPORTAÇÃO E PARSER INTELIGENTE DE ARQUIVOS (DOCX, JSON, TXT/PDF)
 */
export async function parseQuoteFromFile(file: File): Promise<Partial<DetailedQuote>> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'json') {
    const text = await file.text();
    const data = JSON.parse(text);
    return data;
  }

  if (ext === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return parseQuoteFromText(result.value);
  }

  // Tenta ler como texto
  const text = await file.text();
  return parseQuoteFromText(text);
}

/**
 * Parser de texto bruto (para mensagens de WhatsApp, anotações ou documentos exportados).
 */
export function parseQuoteFromText(text: string): Partial<DetailedQuote> {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  let clientName = '';
  let clientPhone = '';
  let providerName = '';
  let title = '';
  let category = '';
  const items: DetailedQuoteItem[] = [];
  let estimatedDays = '';
  let paymentTerms = '';
  let notes = '';

  // Regex helpers
  for (const line of lines) {
    const lower = line.toLowerCase();

    // Cliente
    if (lower.includes('cliente:') || lower.includes('para:')) {
      clientName = line.split(/cliente:|para:/i)[1]?.trim() || clientName;
    }
    // Prestador
    if (lower.includes('prestador:') || lower.includes('profissional:')) {
      providerName = line.split(/prestador:|profissional:/i)[1]?.trim() || providerName;
    }
    // Telefone
    if (lower.includes('whatsapp:') || lower.includes('telefone:') || lower.includes('contato:')) {
      const match = line.match(/\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}/);
      if (match) clientPhone = match[0];
    }
    // Categoria
    if (lower.includes('categoria:')) {
      category = line.split(/categoria:/i)[1]?.trim() || category;
    }
    // Título / Serviço
    if (lower.includes('serviço:') || lower.includes('orçamento de') || lower.includes('proposta:')) {
      title = line.replace(/^[#*_\s]+/, '').trim();
    }
    // Prazos
    if (lower.includes('prazo:') || lower.includes('prazo de execução:')) {
      estimatedDays = line.split(/prazo:?|execução:?/i)[1]?.trim() || estimatedDays;
    }
    // Pagamento
    if (lower.includes('pagamento:') || lower.includes('forma de pagamento:')) {
      paymentTerms = line.split(/pagamento:/i)[1]?.trim() || paymentTerms;
    }
    // Observações
    if (lower.includes('observações:') || lower.includes('obs:')) {
      notes = line.split(/observações:|obs:/i)[1]?.trim() || notes;
    }

    // Linha de item (Ex: "1. Troca de disjuntor - 1x R$ 250 = R$ 250" ou "Mão de obra R$ 150")
    const priceMatch = line.match(/R\$\s*([\d.,]+)/i);
    if (priceMatch && !lower.includes('total:') && !lower.includes('subtotal:')) {
      const priceStr = priceMatch[1].replace(/\./g, '').replace(',', '.');
      const unitPrice = parseFloat(priceStr) || 100;
      
      const cleanDesc = line
        .replace(/^\d+[\s.-]+/, '')
        .replace(/R\$\s*[\d.,]+/gi, '')
        .replace(/[-=–]/g, '')
        .trim();

      if (cleanDesc.length > 2) {
        items.push({
          id: `imp-${Date.now()}-${Math.random()}`,
          description: cleanDesc,
          type: lower.includes('material') ? 'material' : 'labor',
          quantity: 1,
          unit: 'un',
          unitPrice,
          totalPrice: unitPrice,
        });
      }
    }
  }

  return {
    clientName,
    clientPhone,
    providerName,
    title: title || 'Orçamento de Manutenção e Reparos',
    category: category || 'Geral',
    items: items.length > 0 ? items : undefined,
    estimatedDays: estimatedDays || '1 a 2 dias',
    paymentTerms: paymentTerms || '50% entrada + 50% conclusão',
    notes,
  };
}
