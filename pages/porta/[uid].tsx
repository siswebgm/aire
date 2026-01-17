import React, { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { MoreVertical, RefreshCw, ShieldCheck, ShieldOff, AlertTriangle, DoorOpen } from 'lucide-react'
import type { Porta } from 'src/types/gaveteiro'
import { ocuparPorta, liberarPortaComSenha, cancelarOcupacao, darBaixaPorta, liberarPorta, atualizarStatusPorta, registrarMovimentacao, type Destinatario } from 'src/services/gaveteiroService'
import { useAuth } from 'src/contexts/AuthContext'
import { supabase } from 'src/lib/supabaseClient'
import jsPDF from 'jspdf'
import { MainLayout } from '../../components/MainLayout'
import { PageHeader } from '../../components/PageHeader'

interface PortaDetalhada extends Porta {
  gaveteiro_nome?: string
  gaveteiro_codigo?: string
}

export default function DetalhesPorta() {
  const { condominio } = useAuth()
  const router = useRouter()
  const { uid } = router.query as { uid: string }
  
  const [porta, setPorta] = useState<PortaDetalhada | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingAcao, setLoadingAcao] = useState(false)
  const [salvandoConfigPortaria, setSalvandoConfigPortaria] = useState(false)
  const [abrindoPortaPortaria, setAbrindoPortaPortaria] = useState(false)
  const [agora, setAgora] = useState<Date>(() => new Date())
  const [senhaLiberacao, setSenhaLiberacao] = useState('')
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([{ bloco: '', apartamento: '' }])
  const [showOcuparForm, setShowOcuparForm] = useState(false)
  const [aviso, setAviso] = useState<{ titulo: string; mensagem: string } | null>(null)
  const [confirmarCancelarAberto, setConfirmarCancelarAberto] = useState(false)
  const [menuAcoesAberto, setMenuAcoesAberto] = useState(false)
  const menuAcoesRef = useRef<HTMLDivElement | null>(null)
  const senhaLiberacaoInputRef = useRef<HTMLInputElement | null>(null)

  const blocosEApartamentosAtuais = (() => {
    const blocoStr = porta?.bloco_atual
    const aptStr = porta?.apartamento_atual
    if (!blocoStr || !aptStr) return [] as Array<{ bloco: string; apartamentos: string[] }>

    const blocos = blocoStr.split(',').map((b) => b.trim()).filter(Boolean)
    const apartamentos = aptStr.split(',').map((a) => a.trim()).filter(Boolean)
    const map = new Map<string, string[]>()

    blocos.forEach((bloco, i) => {
      const apt = apartamentos[i]
      if (!apt) return
      if (!map.has(bloco)) map.set(bloco, [])
      map.get(bloco)!.push(apt)
    })

    return Array.from(map.entries()).map(([bloco, apts]) => ({ bloco, apartamentos: apts }))
  })()

  const mostrarAviso = (mensagem: string, titulo = 'Atenção') => {
    setAviso({ titulo, mensagem })
  }

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  useEffect(() => {
    if (!porta?.ocupado_em) return
    if (porta.status_atual !== 'OCUPADO') return
    const t = setInterval(() => setAgora(new Date()), 30_000)
    return () => clearInterval(t)
  }, [porta?.ocupado_em, porta?.status_atual])

  useEffect(() => {
    if (!menuAcoesAberto) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAcoesAberto(false)
    }

    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      const el = menuAcoesRef.current
      if (!el) return
      if (el.contains(e.target as Node)) return
      setMenuAcoesAberto(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [menuAcoesAberto])

  const formatarTempoOcupacao = (ocupadoEm: string | null | undefined) => {
    if (!ocupadoEm) return '—'
    const inicio = new Date(ocupadoEm)
    if (Number.isNaN(inicio.getTime())) return '—'

    const diffMs = agora.getTime() - inicio.getTime()
    if (diffMs < 0) return '—'

    const totalMin = Math.floor(diffMs / 60000)
    const dias = Math.floor(totalMin / (60 * 24))
    const horas = Math.floor((totalMin % (60 * 24)) / 60)
    const mins = totalMin % 60

    const partes: string[] = []
    if (dias > 0) partes.push(`${dias}d`)
    if (horas > 0 || dias > 0) partes.push(`${horas}h`)
    partes.push(`${mins}m`)
    return partes.join(' ')
  }

  // Função para gerar SHA256 (compatível com browser)
  const generateSHA256 = async (message: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(message)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
  }

  useEffect(() => {
    if (uid && condominio?.uid) {
      carregarPorta()
    }
  }, [uid, condominio?.uid])

  const carregarPorta = async () => {
    if (!uid || !condominio?.uid) return
    
    setLoading(true)
    try {
      // Buscar porta específica
      const { data, error } = await supabase
        .from('gvt_portas')
        .select(`
          *,
          gvt_gaveteiros (
            uid,
            nome,
            codigo_hardware
          )
        `)
        .eq('uid', uid)
        .eq('condominio_uid', condominio.uid)
        .single()

      if (error) throw error
      
      const portaDetalhada: PortaDetalhada = {
        ...data,
        gaveteiro_nome: data.gvt_gaveteiros?.nome,
        gaveteiro_codigo: data.gvt_gaveteiros?.codigo_hardware
      }
      
      setPorta(portaDetalhada)
    } catch (error) {
      console.error('Erro ao carregar porta:', error)
      mostrarAviso('Erro ao carregar porta')
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const toggleReservadaPortaria = async (nextValue: boolean) => {
    if (!porta || !condominio?.uid) return
    if (salvandoConfigPortaria) return

    if (porta.status_atual !== 'DISPONIVEL') {
      mostrarAviso('Para reservar a porta para portaria, ela precisa estar DISPONÍVEL (não ocupada).')
      return
    }

    setSalvandoConfigPortaria(true)
    try {
      const { error } = await supabase
        .from('gvt_portas')
        .update({ reservada_portaria: nextValue })
        .eq('uid', porta.uid)
        .eq('condominio_uid', condominio.uid)

      if (error) throw error
      await carregarPorta()
      mostrarAviso(nextValue ? 'Porta reservada para portaria.' : 'Porta voltou ao uso normal.')
    } catch (e: any) {
      console.error('Erro ao atualizar reservada_portaria:', e)
      mostrarAviso(e?.message || 'Erro ao salvar configuração')
    } finally {
      setSalvandoConfigPortaria(false)
    }
  }

  const abrirPortaPortariaAgora = async () => {
    if (!porta || !condominio?.uid) return
    if (!porta.reservada_portaria) return
    if (abrindoPortaPortaria) return

    setAbrindoPortaPortaria(true)
    try {
      const TIMEOUT_MS = 15_000
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

      let response: Response
      try {
        response = await fetch('/api/proxy/abrir-porta-individual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            condominioUid: condominio.uid,
            portaUid: porta.uid,
            porta: porta.numero_porta
          }),
          signal: controller.signal
        })
      } finally {
        clearTimeout(timeoutId)
      }

      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Não foi possível abrir a porta')
      }

      mostrarAviso('Comando enviado. A porta deve abrir agora.', 'Portaria')
    } catch (e: any) {
      const msg = e?.name === 'AbortError'
        ? 'Tempo esgotado ao tentar abrir a porta.'
        : (e?.message || 'Erro ao abrir a porta')
      mostrarAviso(msg)
    } finally {
      setAbrindoPortaPortaria(false)
    }
  }

  const executarAcaoPorta = async (acao: 'liberar' | 'cancelar') => {
    if (!porta || !condominio?.uid) return

    setLoadingAcao(true)
    try {
      if (acao === 'liberar') {
        if (!senhaLiberacao) {
          mostrarAviso('Informe a senha de liberação')
          return
        }

        const result = await liberarPortaComSenha(
          porta.uid,
          condominio.uid,
          senhaLiberacao
        )
        
        if (result.sucesso) {
          // Se a senha foi validada e a porta está sendo liberada
          if (result.portaLiberada) {
            // 1. Fazer GET para abrir a porta fisicamente (não-bloqueante)
            if (porta.gaveteiro_codigo && porta.gaveteiro_codigo.trim() !== '') {
              // Gerar token SHA256 dinâmico como o ESP32 espera
              const AIRE_ESP_SECRET = "AIRE_2025_SUPER_SECRETO"
              const base = `${condominio.uid}:${porta.uid}:${porta.numero_porta}:${AIRE_ESP_SECRET}`
              
              // Gerar SHA256 (implementação simples para browser)
              const token = await generateSHA256(base)
              
              // Usar IP direto se o código for um nome, ou usar o código diretamente se já for IP
              let baseUrl = porta.gaveteiro_codigo
              if (!porta.gaveteiro_codigo.match(/^\d+\.\d+\.\d+\.\d+$/)) {
                // Se não for um IP, assume que é um nome e usa o IP padrão
                baseUrl = '192.168.1.76'
              }
              
              const url = `http://${baseUrl}/abrir?condominio_uid=${condominio.uid}&porta_uid=${porta.uid}&porta=${porta.numero_porta}&token=${token}`
              console.log(`[ABRIR PORTA] GET: ${url}`)
              console.log(`[ABRIR PORTA] Token gerado para base: ${base}`)
              
              // Verificar se está em ambiente de desenvolvimento
              const isDevelopment = process.env.NODE_ENV === 'development'
              
              if (isDevelopment) {
                // Em desenvolvimento, usar Image para evitar CORS (hack para bypass)
                console.log('[ABRIR PORTA] Ambiente de desenvolvimento detectado, usando bypass CORS')
                const img = new Image()
                img.src = url
                img.onerror = () => console.log('[ABRIR PORTA] Requisição enviada (pode ter falhado silenciosamente)')
                img.onload = () => console.log('[ABRIR PORTA] Requisição enviada com sucesso')
              } else {
                // Em produção, usar fetch normal
                setTimeout(() => {
                  try {
                    fetch(url, { 
                      method: 'GET',
                      mode: 'no-cors',
                      cache: 'no-cache'
                    }).catch((error) => {
                      console.error(`[ABRIR PORTA] Erro ao abrir porta:`, error)
                    })
                  } catch (error) {
                    console.error('[ABRIR PORTA] Erro na requisição:', error)
                  }
                }, 100)
              }
            } else {
              console.warn('[ABRIR PORTA] Código do gaveteiro inválido, pulando abertura física')
            }

            // 2. Liberar porta (status DISPONIVEL em vez de BAIXADO)
            try {
              await liberarPorta(porta.uid, condominio.uid)
              console.log(`[LIBERAR] Porta ${porta.numero_porta} liberada com sucesso`)
            } catch (error) {
              console.error('[LIBERAR] Erro ao liberar porta:', error)
              // Continua o fluxo mesmo se a liberação falhar
            }
          }
          
          await carregarPorta()
          setSenhaLiberacao('')
        } else {
          mostrarAviso(result.mensagem)
          return
        }
        
      } else if (acao === 'cancelar') {
        const result = await cancelarOcupacao(
          porta.uid,
          condominio.uid,
          'Cancelado pelo administrador'
        )
        
        if (result.sucesso) {
          await carregarPorta()
        } else {
          mostrarAviso(result.mensagem)
          return
        }
      }
    } catch (error: any) {
      console.error('Erro ao executar ação na porta:', error)
      mostrarAviso(error.message || 'Erro ao executar ação')
    } finally {
      setLoadingAcao(false)
    }
  }

  const adicionarDestinatario = () => {
    setDestinatarios([...destinatarios, { bloco: '', apartamento: '' }])
  }

  const removerDestinatario = (index: number) => {
    setDestinatarios(destinatarios.filter((_, i) => i !== index))
  }

  const atualizarDestinatario = (index: number, campo: 'bloco' | 'apartamento', valor: string) => {
    const novos = [...destinatarios]
    novos[index][campo] = valor
    setDestinatarios(novos)
  }

  const formatarData = (data: string | null | undefined) => {
    if (!data) return 'N/A'
    return new Date(data).toLocaleString('pt-BR')
  }

  const baixarPDF = () => {
    if (!porta) return

    const pdf = new jsPDF()
    
    // Configurações do documento
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const marginX = 18
    const contentWidth = pageWidth - marginX * 2

    const ensureSpace = (heightNeeded: number) => {
      if (yPosition + heightNeeded <= pageHeight - 18) return
      pdf.addPage()
      yPosition = 28
    }

    const drawSectionHeader = (title: string) => {
      ensureSpace(18)
      pdf.setFillColor(241, 245, 249)
      pdf.roundedRect(marginX, yPosition - 6, contentWidth, 12, 2, 2, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.setTextColor(15, 23, 42)
      pdf.text(title, marginX + 4, yPosition + 2)
      pdf.setTextColor(0, 0, 0)
      pdf.setFont('helvetica', 'normal')
      yPosition += 14
    }

    const drawLabelValue = (label: string, value: string) => {
      ensureSpace(8)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(30, 41, 59)
      pdf.text(`${label}:`, marginX, yPosition)
      const labelW = pdf.getTextWidth(`${label}: `)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(15, 23, 42)
      pdf.text(value, marginX + labelW, yPosition)
      pdf.setTextColor(0, 0, 0)
      yPosition += 7
    }

    pdf.setFillColor(79, 70, 229)
    pdf.rect(0, 0, pageWidth, 30, 'F')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.setTextColor(255, 255, 255)
    pdf.text('RELATÓRIO DA PORTA', marginX, 18)

    const condominioNome = condominio?.nome || 'Condomínio'
    pdf.setFontSize(11)
    pdf.setTextColor(224, 231, 255)
    pdf.text(condominioNome, marginX, 25)

    pdf.setTextColor(0, 0, 0)
    pdf.setFont('helvetica', 'normal')

    let yPosition = 44

    // Informações Principais
    drawSectionHeader('INFORMAÇÕES PRINCIPAIS')
    drawLabelValue('Número da Porta', String(porta.numero_porta))
    drawLabelValue('Status Atual', String(porta.status_atual))
    yPosition += 3
    
    // Gaveteiro
    drawSectionHeader('GAVETEIRO')
    drawLabelValue('Nome', porta.gaveteiro_nome || 'N/A')
    yPosition += 3
    
    // Informações de Ocupação
    drawSectionHeader('INFORMAÇÕES DE OCUPAÇÃO')
    drawLabelValue('Ocupada em', formatarData(porta.ocupado_em))
    
    // Blocos e Apartamentos organizados
    if (porta.bloco_atual && porta.apartamento_atual) {
      const blocos = porta.bloco_atual.split(', ').map(b => b.trim())
      const apartamentos = porta.apartamento_atual.split(', ').map(a => a.trim())
      const blocoApartamentoMap = new Map<string, string[]>()

      blocos.forEach((bloco, index) => {
        if (apartamentos[index]) {
          if (!blocoApartamentoMap.has(bloco)) {
            blocoApartamentoMap.set(bloco, [])
          }
          blocoApartamentoMap.get(bloco)?.push(apartamentos[index])
        }
      })

      ensureSpace(10)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(30, 41, 59)
      pdf.text('Blocos e Apartamentos:', marginX, yPosition)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(15, 23, 42)
      yPosition += 7
      
      Array.from(blocoApartamentoMap.entries()).forEach(([bloco, apts]) => {
        ensureSpace(8)
        pdf.text(`${bloco}: ${apts.join(', ')}`, marginX + 4, yPosition)
        yPosition += 7
      })
    } else {
      drawLabelValue('Blocos e Apartamentos', 'N/A')
    }
    
    drawLabelValue('Compartilhada', porta.compartilhada ? 'Sim' : 'Não')
    yPosition += 3
    
    // Status do Hardware
    drawSectionHeader('STATUS DO HARDWARE')
    drawLabelValue('Fechadura', porta.fechadura_status || 'Desconhecido')
    drawLabelValue('Último Evento', formatarData(porta.ultimo_evento_em))
    yPosition += 3
    
    // Rodapé
    const totalPages = pdf.getNumberOfPages()
    for (let page = 1; page <= totalPages; page++) {
      pdf.setPage(page)
      const footerY = pageHeight - 12
      pdf.setDrawColor(226, 232, 240)
      pdf.setLineWidth(0.4)
      pdf.line(marginX, footerY - 6, marginX + contentWidth, footerY - 6)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(100, 116, 139)
      pdf.text('AIRE — armário inteligente de recebimento e entrega', marginX, footerY)
      pdf.text(`Página ${page} de ${totalPages}`, marginX + contentWidth, footerY, { align: 'right' })
      pdf.setTextColor(0, 0, 0)
    }
    
    // Salvar o PDF
    pdf.save(`porta_${porta.numero_porta}_relatorio_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="w-full flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      </MainLayout>
    )
  }

  if (!porta) {
    return (
      <MainLayout>
        <div className="w-full flex items-center justify-center py-16">
          <div className="text-center">
            <p className="text-gray-500">Porta não encontrada</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Voltar
            </button>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <>
        <Head>
          <title>Porta {porta.numero_porta} - AIRE</title>
          <meta name="description" content={`Configurações da Porta ${porta.numero_porta}`} />
        </Head>

        {aviso ? (
          <div className="fixed top-4 right-4 z-[9999] w-[calc(100vw-2rem)] max-w-sm pointer-events-none">
            <div className="bg-emerald-600/95 backdrop-blur rounded-2xl shadow-2xl border border-emerald-500/40 p-4 pointer-events-auto">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex items-start gap-3">
                  <div className="mt-0.5">
                    <ShieldCheck className="w-5 h-5 text-white/95" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-white/95 uppercase tracking-wide">{aviso.titulo}</div>
                    <div className="mt-1 text-sm font-semibold text-white break-words">{aviso.mensagem}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAviso(null)}
                  className="h-8 w-8 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-extrabold flex items-center justify-center"
                  aria-label="Fechar aviso"
                  title="Fechar"
                >
                  ×
                </button>
              </div>

              <div className="mt-3 h-1 w-full bg-white/20 rounded-full overflow-hidden">
                <div className="h-full w-2/3 bg-white/70 rounded-full" />
              </div>
            </div>
          </div>
        ) : null}

        {confirmarCancelarAberto ? (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setConfirmarCancelarAberto(false)}
            />
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5">
              <div className="text-base font-extrabold text-slate-900">Confirmar cancelamento</div>
              <div className="mt-1 text-sm text-slate-600">
                Deseja cancelar a ocupação desta porta?
              </div>

              <div className="mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Porta</div>
                    <div className="mt-1 text-sm font-extrabold text-slate-900">{porta.numero_porta}</div>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Destino</div>
                    {blocosEApartamentosAtuais.length ? (
                      <div className="mt-1 space-y-1">
                        {blocosEApartamentosAtuais.map((item) => (
                          <div key={item.bloco} className="text-sm font-bold text-slate-900">
                            {item.bloco}: {item.apartamentos.join(', ')}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1 text-sm font-bold text-slate-900">N/A</div>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Data de Ocupação</div>
                  {porta.ocupado_em ? (
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm font-extrabold text-slate-900">
                      <span>{new Date(porta.ocupado_em).toLocaleDateString('pt-BR')}</span>
                      <span className="text-slate-700">{new Date(porta.ocupado_em).toLocaleTimeString('pt-BR')}</span>
                    </div>
                  ) : (
                    <div className="mt-1 text-sm font-extrabold text-slate-900">N/A</div>
                  )}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmarCancelarAberto(false)}
                  className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmarCancelarAberto(false)
                    executarAcaoPorta('cancelar')
                  }}
                  disabled={loadingAcao}
                  className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-6">
          <PageHeader
            title="Configurações da Porta"
            sticky={false}
            actions={
              <div className="flex items-center gap-2">
                <div
                  className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${
                    porta.status_atual === 'DISPONIVEL' ? 'status-badge-available' : 'status-badge-occupied'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  {porta.status_atual === 'DISPONIVEL' ? 'Disponível' : 'Ocupada'}
                </div>

                <div ref={menuAcoesRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuAcoesAberto((v) => !v)}
                    className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    aria-label="Mais ações"
                    aria-haspopup="menu"
                    aria-expanded={menuAcoesAberto}
                    title="Mais ações"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {menuAcoesAberto ? (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-44 rounded-2xl bg-white shadow-2xl border border-slate-200 p-1 z-50"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuAcoesAberto(false)
                          baixarPDF()
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Baixar
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        disabled={porta.status_atual !== 'OCUPADO'}
                        onClick={() => {
                          setMenuAcoesAberto(false)
                          setConfirmarCancelarAberto(true)
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        disabled={porta.status_atual !== 'OCUPADO'}
                        onClick={() => {
                          setMenuAcoesAberto(false)
                          setTimeout(() => {
                            senhaLiberacaoInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            senhaLiberacaoInputRef.current?.focus()
                          }, 50)
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        Liberar
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            }
          />

          {/* Card Principal - Informações Básicas */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-white">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Informações da Porta</h2>
                <p className="text-sm text-slate-500">Dados principais</p>
              </div>
            </div>
              
            <div className="p-6 space-y-6">
              {/* Informações Detalhadas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Número da Porta</div>
                  <div className="mt-1 text-2xl font-extrabold text-slate-900">{porta.numero_porta}</div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Data de Ocupação</div>
                  <div className="mt-1 text-base font-bold text-slate-900">
                    {porta.ocupado_em ? new Date(porta.ocupado_em).toLocaleString('pt-BR') : 'Não ocupada'}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tempo de ocupação</div>
                  <div className="mt-1 text-base font-bold text-slate-900">
                    {porta.status_atual === 'OCUPADO' ? formatarTempoOcupacao(porta.ocupado_em) : '—'}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Compartilhada</div>
                    <div className="mt-1 text-base font-bold text-slate-900">{porta.compartilhada ? 'Sim' : 'Não'}</div>
                  </div>
                  <span
                    className={
                      `inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold border ` +
                      (porta.compartilhada ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-slate-50 text-slate-600 border-slate-200')
                    }
                  >
                    {porta.compartilhada ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Portaria</h2>
                  <p className="text-sm text-slate-500">Reservar esta porta para uso interno (sem registro de mercadorias)</p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleReservadaPortaria(!porta.reservada_portaria)}
                  disabled={salvandoConfigPortaria || porta.status_atual !== 'DISPONIVEL'}
                  className={
                    `relative w-12 h-7 rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ` +
                    (porta.reservada_portaria ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-300')
                  }
                  aria-label="Alternar modo portaria"
                  title="Alternar modo portaria"
                >
                  <span
                    className={
                      `absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ` +
                      (porta.reservada_portaria ? 'translate-x-5' : 'translate-x-0')
                    }
                  />
                  {salvandoConfigPortaria ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <RefreshCw size={16} className="animate-spin text-white" />
                    </span>
                  ) : null}
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div
                className={
                  `rounded-2xl border p-5 ` +
                  (porta.reservada_portaria
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-slate-200 bg-slate-50')
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {porta.reservada_portaria ? (
                        <ShieldCheck className="w-5 h-5 text-emerald-700" />
                      ) : (
                        <ShieldOff className="w-5 h-5 text-slate-600" />
                      )}
                      <div className="text-base font-extrabold text-slate-900">
                        {porta.reservada_portaria ? 'MODO PORTARIA ATIVO' : 'MODO PORTARIA INATIVO'}
                      </div>
                      <span
                        className={
                          `ml-1 inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border ` +
                          (porta.reservada_portaria
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-700 border-slate-200')
                        }
                      >
                        {porta.reservada_portaria ? 'ATIVA' : 'INATIVA'}
                      </span>
                    </div>

                    <div className="mt-2 text-sm font-semibold text-slate-700">
                      Ao ativar, esta porta <span className="font-extrabold">não será usada em entregas</span>.
                      Use para guardar itens internos e abra quando precisar.
                    </div>

                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5" />
                        <div className="text-xs font-semibold text-amber-900">
                          Esta opção só pode ser alterada quando a porta estiver <span className="font-extrabold">DISPONÍVEL</span>.
                        </div>
                      </div>
                    </div>
                  </div>

                  {porta.reservada_portaria ? (
                    <button
                      type="button"
                      onClick={abrirPortaPortariaAgora}
                      disabled={abrindoPortaPortaria}
                      className="shrink-0 inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-extrabold hover:bg-slate-50 disabled:opacity-50"
                      title="Abrir porta"
                    >
                      {abrindoPortaPortaria ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <DoorOpen size={14} />
                      )}
                      Abrir
                    </button>
                  ) : (
                    <div className="w-12" />
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Card Localização */}
          {porta.bloco_atual && porta.apartamento_atual && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 bg-white">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Localização</h2>
                  <p className="text-sm text-slate-500">Blocos e apartamentos vinculados</p>
                </div>
              </div>
                
              <div className="p-6">
                {(() => {
                  const blocos = porta.bloco_atual.split(', ').map(b => b.trim())
                  const apartamentos = porta.apartamento_atual.split(', ').map(a => a.trim())
                  const blocoApartamentoMap = new Map<string, string[]>()

                  blocos.forEach((bloco, index) => {
                    if (apartamentos[index]) {
                      if (!blocoApartamentoMap.has(bloco)) {
                        blocoApartamentoMap.set(bloco, [])
                      }
                      blocoApartamentoMap.get(bloco)?.push(apartamentos[index])
                    }
                  })

                  return (
                    <div className="space-y-3">
                      {Array.from(blocoApartamentoMap.entries()).map(([bloco, apts]) => (
                        <div key={bloco} className="bg-white rounded-2xl border border-slate-200 p-5">
                          <div className="flex items-center justify-between gap-4">
                            <div className="text-base font-extrabold text-slate-900 truncate">{bloco}</div>
                            <span className="text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                              {apts.length} apto(s)
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {apts.map(apt => (
                              <span
                                key={`${bloco}-${apt}`}
                                className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-slate-50 text-slate-700 border border-slate-200"
                              >
                                {apt}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Card Status Hardware */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-white">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Status do Hardware</h2>
                <p className="text-sm text-slate-500">Informações do dispositivo</p>
              </div>
            </div>
              
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fechadura</div>
                    <div className="mt-1 text-base font-bold text-slate-900">{porta.fechadura_status || 'Desconhecido'}</div>
                  </div>
                  <span
                    className={
                      `inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold border ` +
                      (porta.fechadura_status === 'aberta'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : porta.fechadura_status === 'fechada'
                          ? 'bg-rose-50 text-rose-700 border-rose-100'
                          : 'bg-slate-50 text-slate-600 border-slate-200')
                    }
                  >
                    {porta.fechadura_status === 'aberta'
                      ? 'Aberta'
                      : porta.fechadura_status === 'fechada'
                        ? 'Fechada'
                        : 'N/A'}
                  </span>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Último Evento</div>
                  <div className="mt-1 text-base font-bold text-slate-900">{formatarData(porta.ultimo_evento_em)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Card Ações */}
          <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 bg-white">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Ações</h2>
                  <p className="text-sm text-slate-500">Gerencie a porta</p>
                </div>
              </div>
                
              <div className="p-6 space-y-4">
                {porta.status_atual === 'OCUPADO' && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 mb-3">Liberar Porta</h3>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <input
                          ref={senhaLiberacaoInputRef}
                          type="password"
                          placeholder="Senha de liberação"
                          value={senhaLiberacao}
                          onChange={(e) => setSenhaLiberacao(e.target.value)}
                          className="w-full sm:flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 text-sm transition-all duration-200"
                          style={{ background: 'rgba(249,250,251,0.5)' }}
                        />

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => executarAcaoPorta('liberar')}
                            disabled={loadingAcao}
                            className="btn-gradient-blue h-10 px-4 flex items-center justify-center gap-2 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm"
                          >
                            {loadingAcao ? <RefreshCw size={18} className="animate-spin" /> : null}
                            Liberar
                          </button>

                          <button
                            onClick={() => setConfirmarCancelarAberto(true)}
                            disabled={loadingAcao}
                            className="btn-gradient-red h-10 px-4 flex items-center justify-center gap-2 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm"
                          >
                            {loadingAcao ? <RefreshCw size={18} className="animate-spin" /> : null}
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {porta.status_atual === 'DISPONIVEL' && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">Porta disponível</div>
                        <div className="text-sm text-slate-500 mt-0.5">Nenhuma ação necessária</div>
                      </div>
                      <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-100">
                        OK
                      </span>
                    </div>
                  </div>
                )}
              </div>
          </div>
        </div>
      </>
    </MainLayout>
  )
}
