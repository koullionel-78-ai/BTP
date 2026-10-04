import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import DocumentForm, { type DocSaisie } from '../components/DocumentForm'
import { supabase } from '../lib/supabase'
import { carte } from '../lib/ui'
import { peutGerer, type Devis, type Ligne } from '../types'

export default function DevisForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { profil } = useAuth()
  const [clients, setClients] = useState<{ id: string; nom: string }[]>([])
  const [chantiers, setChantiers] = useState<{ id: string; titre: string; client_id: string | null }[]>([])
  const [initial, setInitial] = useState<Partial<DocSaisie> | null>(null)
  const [tvaDefaut, setTvaDefaut] = useState<number | null>(null)
  const [interdit, setInterdit] = useState('')

  useEffect(() => {
    void (async () => {
      const [c, ch, ent] = await Promise.all([
        supabase.from('clients').select('id, nom').order('nom'),
        supabase.from('chantiers').select('id, titre, client_id').order('titre'),
        supabase.from('entreprise').select('tva_defaut').eq('id', 1).maybeSingle(),
      ])
      setClients((c.data ?? []) as { id: string; nom: string }[])
      setChantiers((ch.data ?? []) as { id: string; titre: string; client_id: string | null }[])
      setTvaDefaut(Number(ent.data?.tva_defaut ?? 0))
      if (!id) {
        return setInitial({ client_id: params.get('client') ?? '', chantier_id: params.get('chantier') ?? null })
      }
      const [d, l] = await Promise.all([
        supabase.from('devis_totaux').select('*').eq('id', id).maybeSingle(),
        supabase.from('lignes_devis').select('*').eq('devis_id', id).order('position'),
      ])
      const devis = d.data as Devis | null
      if (!devis) return setInterdit('Devis introuvable.')
      if (devis.statut === 'accepte') return setInterdit('Un devis accepté ne peut plus être modifié.')
      setInitial({ ...devis, lignes: (l.data ?? []) as Ligne[] })
    })()
  }, [id])

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>
  if (interdit) return <p className={carte}>{interdit}</p>
  if (!initial || tvaDefaut === null) return <p className="text-center text-gray-500">Chargement…</p>

  async function enregistrer(v: DocSaisie) {
    const { lignes, date_echeance: _e, ...entete } = v
    let devisId = id
    let anciennes: string[] = []
    if (id) {
      const { data: avant } = await supabase.from('lignes_devis').select('id').eq('devis_id', id)
      anciennes = (avant ?? []).map((x) => x.id as string)
      const { error } = await supabase.from('devis').update(entete).eq('id', id)
      if (error) return error.message
    } else {
      const { data, error } = await supabase.from('devis').insert(entete).select('id').single()
      if (error) return error.message
      devisId = data.id as string
    }
    // Les nouvelles lignes sont ajoutées avant de retirer les anciennes : rien n'est perdu en cas d'erreur.
    const ins = await supabase.from('lignes_devis').insert(
      lignes.map((l, i) => ({ devis_id: devisId, position: i, description: l.description, quantite: l.quantite, unite: l.unite, prix_unitaire: l.prix_unitaire })),
    )
    if (ins.error) return ins.error.message
    if (anciennes.length) {
      const suppr = await supabase.from('lignes_devis').delete().in('id', anciennes)
      if (suppr.error) return suppr.error.message
    }
    nav(`/devis/${devisId}`)
    return null
  }

  return (
    <div className="space-y-3">
      <Link to={id ? `/devis/${id}` : '/devis'} className="text-sm underline">← Retour</Link>
      <h1 className="text-xl font-bold">{id ? 'Modifier le devis' : 'Nouveau devis'}</h1>
      <DocumentForm
        type="devis"
        clients={clients}
        chantiers={chantiers}
        initial={id ? initial : { tva_pct: tvaDefaut, ...initial }}
        libelle={id ? 'Enregistrer' : 'Créer le devis'}
        onSubmit={enregistrer}
      />
    </div>
  )
}
