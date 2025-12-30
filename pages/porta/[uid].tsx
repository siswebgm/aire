import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Key, ArrowLeft, Users, Package, Trash2, RefreshCw, AlertTriangle, Download } from 'lucide-react'
import type { Porta } from 'src/types/gaveteiro'
import { ocuparPorta, liberarPortaComSenha, cancelarOcupacao, darBaixaPorta, liberarPorta, atualizarStatusPorta, registrarMovimentacao, type Destinatario } from 'src/services/gaveteiroService'
import { useAuth } from 'src/contexts/AuthContext'
import { supabase } from 'src/lib/supabaseClient'
import jsPDF from 'jspdf'

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
  const [senhaLiberacao, setSenhaLiberacao] = useState('')
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([{ bloco: '', apartamento: '' }])
  const [showOcuparForm, setShowOcuparForm] = useState(false)

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
      alert('Erro ao carregar porta')
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const executarAcaoPorta = async (acao: 'liberar' | 'cancelar') => {
    if (!porta || !condominio?.uid) return

    setLoadingAcao(true)
    try {
      if (acao === 'liberar') {
        if (!senhaLiberacao) {
          throw new Error('Informe a senha de liberação')
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
          throw new Error(result.mensagem)
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
          throw new Error(result.mensagem)
        }
      }
    } catch (error: any) {
      console.error('Erro ao executar ação na porta:', error)
      alert(error.message || 'Erro ao executar ação')
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
    pdf.setFontSize(20)
    pdf.text('RELATÓRIO DE CONFIGURAÇÕES DA PORTA', 20, 30)
    
    pdf.setFontSize(12)
    pdf.line(20, 35, 190, 35)
    
    let yPosition = 50
    
    // Informações Principais
    pdf.setFontSize(14)
    pdf.text('INFORMAÇÕES PRINCIPAIS', 20, yPosition)
    yPosition += 10
    
    pdf.setFontSize(10)
    pdf.text(`Número da Porta: ${porta.numero_porta}`, 20, yPosition)
    yPosition += 7
    pdf.text(`Status Atual: ${porta.status_atual}`, 20, yPosition)
    yPosition += 7
    pdf.text(`UID: ${porta.uid}`, 20, yPosition)
    yPosition += 15
    
    // Gaveteiro
    pdf.setFontSize(14)
    pdf.text('GAVETEIRO', 20, yPosition)
    yPosition += 10
    
    pdf.setFontSize(10)
    pdf.text(`Nome: ${porta.gaveteiro_nome || 'N/A'}`, 20, yPosition)
    yPosition += 7
    pdf.text(`Código Hardware: ${porta.gaveteiro_codigo || 'N/A'}`, 20, yPosition)
    yPosition += 15
    
    // Informações de Ocupação
    pdf.setFontSize(14)
    pdf.text('INFORMAÇÕES DE OCUPAÇÃO', 20, yPosition)
    yPosition += 10
    
    pdf.setFontSize(10)
    pdf.text(`Ocupada em: ${formatarData(porta.ocupado_em)}`, 20, yPosition)
    yPosition += 7
    
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

      pdf.text('Blocos e Apartamentos:', 20, yPosition)
      yPosition += 7
      
      Array.from(blocoApartamentoMap.entries()).forEach(([bloco, apts]) => {
        pdf.text(`  ${bloco}: ${apts.join(', ')}`, 20, yPosition)
        yPosition += 7
      })
    } else {
      pdf.text('Blocos e Apartamentos: N/A', 20, yPosition)
      yPosition += 7
    }
    
    pdf.text(`Compartilhada: ${porta.compartilhada ? 'Sim' : 'Não'}`, 20, yPosition)
    yPosition += 15
    
    // Status do Hardware
    pdf.setFontSize(14)
    pdf.text('STATUS DO HARDWARE', 20, yPosition)
    yPosition += 10
    
    pdf.setFontSize(10)
    pdf.text(`Fechadura: ${porta.fechadura_status || 'Desconhecido'}`, 20, yPosition)
    yPosition += 7
    pdf.text(`Sensor IMA: ${porta.sensor_ima_status || 'Desconhecido'}`, 20, yPosition)
    yPosition += 7
    pdf.text(`Último Evento: ${formatarData(porta.ultimo_evento_em)}`, 20, yPosition)
    yPosition += 15
    
    // Rodapé
    pdf.setFontSize(8)
    pdf.text(`DATA DO RELATÓRIO: ${new Date().toLocaleString('pt-BR')}`, 20, yPosition)
    yPosition += 5
    pdf.text('SISTEMA: AIRE v1.0', 20, yPosition)
    
    // Salvar o PDF
    pdf.save(`porta_${porta.numero_porta}_relatorio_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!porta) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
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
    )
  }

  return (
    <>
      <Head>
        <title>Porta {porta.numero_porta} - AIRE</title>
        <meta name="description" content={`Configurações da Porta ${porta.numero_porta}`} />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-blue-600 border-b border-blue-700">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/')}
                  className="flex items-center justify-center w-8 h-8 text-white hover:text-blue-100 hover:bg-blue-700 rounded-lg transition-all duration-200"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Key size={16} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-white">Configurações da Porta</h1>
                    <p className="text-xs text-white">Porta {porta.numero_porta}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={baixarPDF}
                className="flex items-center justify-center w-8 h-8 text-white hover:text-blue-100 hover:bg-blue-700 rounded-lg transition-all duration-200"
                title="Baixar Relatório"
              >
                <Download size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Coluna Principal */}
            <div className="lg:col-span-4 space-y-6">
              {/* Status Principal */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Principal</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Status Atual:</span>
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                      porta.status_atual === 'DISPONIVEL' ? 'bg-green-100 text-green-800' : 
                      porta.status_atual === 'OCUPADO' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {porta.status_atual}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Número:</span>
                    <span className="text-lg font-bold text-gray-900">{porta.numero_porta}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Gaveteiro:</span>
                    <span className="text-sm font-bold text-gray-900">{porta.gaveteiro_nome || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Código Hardware:</span>
                    <span className="text-xs font-mono text-gray-900 bg-gray-200 px-3 py-1 rounded">{porta.gaveteiro_codigo || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Ocupação */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações de Ocupação</h2>
                <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 inline-flex">
                    <span className="text-sm font-medium text-gray-600">Ocupada em:</span>
                    <span className="text-sm font-bold text-blue-900">
                      {porta.ocupado_em ? 
                        new Date(porta.ocupado_em).toLocaleString('pt-BR') : 
                        'Não ocupada'
                      }
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 inline-flex">
                    <span className="text-sm font-medium text-gray-600">Blocos:</span>
                    {porta.bloco_atual && porta.apartamento_atual ? (
                      (() => {
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

                        return Array.from(blocoApartamentoMap.entries()).map(([bloco, apts]) => (
                          <div key={bloco} className="flex items-center gap-1">
                            <div className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                              {bloco.replace('Bloco ', '').replace('B', '')}
                            </div>
                            <div className="flex gap-1">
                              {apts.map(apt => (
                                <span key={apt} className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                  {apt}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))
                      })()
                    ) : (
                      <span className="text-gray-500">N/A</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 inline-flex">
                    <span className="text-sm font-medium text-gray-600">Compartilhada:</span>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                      porta.compartilhada ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {porta.compartilhada ? 'Sim' : 'Não'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status do Hardware */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Status do Hardware</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Fechadura:</span>
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                      porta.fechadura_status === 'aberta' ? 'bg-green-100 text-green-800' : 
                      porta.fechadura_status === 'fechada' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {porta.fechadura_status || 'Desconhecido'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Sensor IMA:</span>
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                      porta.sensor_ima_status === 'aberto' ? 'bg-green-100 text-green-800' : 
                      porta.sensor_ima_status === 'fechado' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {porta.sensor_ima_status || 'Desconhecido'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Último Evento:</span>
                    <span className="text-sm font-bold text-gray-900">
                      {formatarData(porta.ultimo_evento_em)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-sm font-medium text-gray-600">UID:</span>
                    <span className="text-xs font-mono text-gray-900 bg-gray-200 px-3 py-1 rounded">{porta.uid}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna de Ações */}
            <div className="space-y-6">
              {/* Ações Disponíveis */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Ações Disponíveis</h2>
                
                {porta.status_atual === 'OCUPADO' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Liberar Porta</h3>
                      <input
                        type="password"
                        placeholder="Senha de liberação"
                        value={senhaLiberacao}
                        onChange={(e) => setSenhaLiberacao(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                      <div className="flex justify-end gap-2 mt-3">
                        <button
                          onClick={() => executarAcaoPorta('liberar')}
                          disabled={loadingAcao || !senhaLiberacao}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                        >
                          {loadingAcao ? (
                            <>
                              <RefreshCw size={14} className="inline animate-spin mr-1" />
                              Processando...
                            </>
                          ) : (
                            'Liberar'
                          )}
                        </button>
                        <button
                          onClick={() => executarAcaoPorta('cancelar')}
                          disabled={loadingAcao}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                        >
                          {loadingAcao ? (
                            <>
                              <RefreshCw size={14} className="inline animate-spin mr-1" />
                              Processando...
                            </>
                          ) : (
                            'Cancelar'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {porta.status_atual === 'DISPONIVEL' && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Nenhuma ação disponível para esta porta</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
