import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { aujourdhui, dateFr, fcfa } from '../lib/format'
import { nombre, qte } from '../lib/stock'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import { LIBELLE_PAIE, UNITE_PAIE, type Avance, type ModePaie, type Paie, type Travailleur } from '../types'

type Onglet = 'paies' | 'avances' | 'personnel'

export default function PaiePage() {
  const { profil } = useAuth()
  const [onglet, setOnglet] = useState<Onglet>('paies')
  const [personnel, setPersonnel] = useState<Travailleur[]>([])
  const [paies, setPaies] = useState<Paie[]>([])
  const [avances, setAvances] = useState<Avance[]>([])
  const [chantiers, setChantiers] = useState<{ id: string; titre: string }[]>([])
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState('')

  const [nom, setNom] = useState(''); const [tel, setTel] = useState('')
  const [mode, setMode] = useState<ModePaie>('jour'); const [taux, setTaux] = useState('')
  const [avT, setAvT] = useState(''); const [avMontant, setAvMontant] = useState(''); const [avDate, setAvDate] = useState(aujourdhui()); const [avNote, setAvNote] = useState('')
  const [pT, setPT] = useState(''); const [pChantier, setPChantier] = useState('')
  const [pDebut, setPDebut] = useState(aujourdhui()); const [pFin, setPFin] = useState(aujourdhui())
  const [pQte, setPQte] = useState(''); const [pTaux, setPTaux] = useState(''); const [pAvances, setPAvances] = useState('0')
  const [pDate, setPDate] = useState(aujourdhui()); const [pDepense, setPDepense] = useState(true)

  async function charger() {
    const [t, p, a, c] = await Promise.all([
      supabase.from('travailleurs_soldes').select('*').eq('actif', true).order('nom'),
      supabase.from('paies').select('*, chantiers(titre)').order('date_paiement', { ascending: false }).order('created_at', { ascending: false }).limit(100),
      supabase.from('avances').select('*').order('date_avance', { ascending: false }).order('created_at', { ascending: false }).limit(100),
      supabase.from('chantiers').select('id, titre').order('titre'),
    ])
    const err = t.error ?? p.error ?? a.error
    if (err) setMsg(err.message)
    setPersonnel((t.data ?? []) as Travailleur[])
    setPaies((p.data ?? []) as Paie[])
    setAvances((a.data ?? []) as Avance[])
    setChantiers((c.data ?? []) as { id: string; titre: string }[])
  }
  useEffect(() => { void charger() }, [])

  if (profil?.role !== 'gerant') return <p className={carte}>Réservé au gérant.</p>

  const nomDe = (id: string) => personnel.find((x) => x.id === id)?.nom ?? '—'
  const choisi = personnel.find((x) => x.id === pT)
  const Q = nombre(pQte); const Tx = nombre(pTaux); const Av = nombre(pAvances)
  const brut = Number.isNaN(Q) || Number.isNaN(Tx) ? null : Math.round(Q * Tx)

  function annoncer(texte: string) { setMsg(''); setOk(texte); setTimeout(() => setOk(''), 3000) }

  async function ajouterTravailleur(e: FormEvent) {
    e.preventDefault()
    const t = nombre(taux)
    if (Number.isNaN(t) || t < 0 || !Number.isInteger(t)) return setMsg('Le taux doit être un entier positif (FCFA).')
    const { error } = await supabase.from('travailleurs').insert({ nom: nom.trim(), telephone: tel.trim() || null, mode, taux: t })
    if (error) return setMsg(error.message)
    setNom(''); setTel(''); setTaux(''); annoncer('Personne ajoutée.')
    await charger()
  }

  async function retirer(t: Travailleur) {
    if (t.solde_avances > 0 && !confirm(`${t.nom} a encore ${fcfa(t.solde_avances)} d'avances non déduites. Le retirer de la liste quand même ?`)) return
    if (t.solde_avances <= 0 && !confirm(`Retirer ${t.nom} de la liste ? L'historique est conservé.`)) return
    const { error } = await supabase.from('travailleurs').update({ actif: false }).eq('id', t.id)
    setMsg(error ? error.message : '')
    await charger()
  }

  async function ajouterAvance(e: FormEvent) {
    e.preventDefault()
    const m = nombre(avMontant)
    if (!avT) return setMsg('Choisissez la personne.')
    if (Number.isNaN(m) || m <= 0 || !Number.isInteger(m)) return setMsg('Le montant doit être un entier supérieur à 0.')
    const { error } = await supabase.from('avances').insert({ travailleur_id: avT, montant: m, date_avance: avDate, note: avNote.trim() || null })
    if (error) return setMsg(error.message)
    setAvMontant(''); setAvNote(''); annoncer('Avance enregistrée.')
    await charger()
  }

  async function supprimerAvance(a: Avance) {
    if (!confirm(`Supprimer l'avance de ${fcfa(a.montant)} à ${nomDe(a.travailleur_id)} ?`)) return
    const { error } = await supabase.from('avances').delete().eq('id', a.id)
    setMsg(error ? error.message : '')
    await charger()
  }

  function choisirPersonne(id: string) {
    setPT(id)
    const t = personnel.find((x) => x.id === id)
    if (t) setPTaux(String(t.taux))
  }

  async function enregistrerPaie(e: FormEvent) {
    e.preventDefault()
    if (!choisi) return setMsg('Choisissez la personne.')
    if (Number.isNaN(Q) || Q <= 0) return setMsg(`Saisissez le nombre de ${UNITE_PAIE[choisi.mode]} (supérieur à 0).`)
    if (Number.isNaN(Tx) || Tx < 0 || !Number.isInteger(Tx)) return setMsg('Le taux doit être un entier positif.')
    if (Number.isNaN(Av) || Av < 0 || !Number.isInteger(Av)) return setMsg('Les avances à déduire doivent être un entier positif ou nul.')
    if (pFin < pDebut) return setMsg('La fin de période est avant le début.')
    if (Av > choisi.solde_avances) return setMsg(`Solde d'avances insuffisant : ${fcfa(choisi.solde_avances)}.`)
    if (brut !== null && Av > brut) return setMsg('Les avances à déduire dépassent le montant de la paie.')
    const { error } = await supabase.rpc('enregistrer_paie', {
      p_travailleur: pT, p_chantier: pChantier || null, p_debut: pDebut, p_fin: pFin, p_mode: choisi.mode,
      p_quantite: Q, p_taux: Tx, p_avances: Av, p_date: pDate, p_depense: pDepense,
    })
    if (error) return setMsg(error.message)
    setPQte(''); setPAvances('0'); annoncer('Paie enregistrée.')
    await charger()
  }

  async function supprimerPaie(p: Paie) {
    if (!confirm(`Supprimer la paie de ${fcfa(p.montant)} versée à ${nomDe(p.travailleur_id)} ? La dépense liée sera supprimée et les avances déduites redeviennent dues.`)) return
    const { error } = await supabase.rpc('supprimer_paie', { p_id: p.id })
    setMsg(error ? error.message : '')
    await charger()
  }

  const onglets: [Onglet, string][] = [['paies', 'Paies'], ['avances', 'Avances'], ['personnel', 'Personnel']]
  const totalAvances = personnel.reduce((s, t) => s + t.solde_avances, 0)

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Paie et avances</h1>
      <div className="flex gap-2">
        {onglets.map(([k, l]) => (
          <button key={k} onClick={() => { setOnglet(k); setMsg('') }} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${onglet === k ? 'bg-nuit text-white' : 'bg-white'}`}>{l}</button>
        ))}
      </div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      {ok && <p className="text-sm text-green-700">{ok}</p>}

      {onglet === 'personnel' && (
        <>
          <form onSubmit={ajouterTravailleur} className={`${carte} space-y-3`}>
            <h2 className="font-bold">Ajouter une personne</h2>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={etiquette}>Nom</label><input className={champ} value={nom} onChange={(e) => setNom(e.target.value)} required /></div>
              <div><label className={etiquette}>Téléphone</label><input className={champ} type="tel" value={tel} onChange={(e) => setTel(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={etiquette}>Mode de paie</label>
                <select className={champ} value={mode} onChange={(e) => setMode(e.target.value as ModePaie)}>
                  {Object.entries(LIBELLE_PAIE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div><label className={etiquette}>Taux (FCFA / {mode === 'jour' ? 'jour' : mode === 'm2' ? 'm²' : 'tâche'})</label><input className={champ} inputMode="numeric" value={taux} onChange={(e) => setTaux(e.target.value)} required /></div>
            </div>
            <button className={btn}>Ajouter</button>
          </form>
          {personnel.map((t) => (
            <div key={t.id} className={`${carte} flex items-center justify-between gap-2`}>
              <div>
                <p className="font-semibold">{t.nom}</p>
                <p className="text-sm text-gray-500">{LIBELLE_PAIE[t.mode]} · {fcfa(t.taux)}{t.telephone && ` · ${t.telephone}`}</p>
                <p className={`text-sm ${t.solde_avances > 0 ? 'font-semibold text-orange-700' : 'text-gray-500'}`}>Avances à déduire : {fcfa(t.solde_avances)}</p>
              </div>
              <button className="text-sm text-red-600" onClick={() => void retirer(t)}>Retirer</button>
            </div>
          ))}
          {!personnel.length && <p className="text-center text-gray-500">Aucune personne enregistrée.</p>}
        </>
      )}

      {onglet === 'avances' && (
        <>
          {totalAvances > 0 && <p className={`${carte} text-sm`}>Avances en cours à déduire : <b>{fcfa(totalAvances)}</b></p>}
          <form onSubmit={ajouterAvance} className={`${carte} space-y-3`}>
            <h2 className="font-bold">Nouvelle avance</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={etiquette}>Personne</label>
                <select className={champ} value={avT} onChange={(e) => setAvT(e.target.value)} required>
                  <option value="">Choisir…</option>
                  {personnel.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
              </div>
              <div><label className={etiquette}>Montant (FCFA)</label><input className={champ} inputMode="numeric" value={avMontant} onChange={(e) => setAvMontant(e.target.value)} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={etiquette}>Date</label><input className={champ} type="date" value={avDate} max={aujourdhui()} onChange={(e) => setAvDate(e.target.value)} required /></div>
              <div><label className={etiquette}>Note</label><input className={champ} value={avNote} onChange={(e) => setAvNote(e.target.value)} placeholder="facultatif" /></div>
            </div>
            <button className={btn}>Enregistrer l'avance</button>
          </form>
          {avances.map((a) => (
            <div key={a.id} className={`${carte} flex items-start justify-between gap-2`}>
              <div>
                <p className="font-semibold">{nomDe(a.travailleur_id)}</p>
                <p className="text-sm text-gray-500">{dateFr(a.date_avance)}{a.note && ` · ${a.note}`}</p>
              </div>
              <div className="text-right"><b>{fcfa(a.montant)}</b><button className="block text-sm text-red-600" onClick={() => void supprimerAvance(a)}>Supprimer</button></div>
            </div>
          ))}
          {!avances.length && <p className="text-center text-gray-500">Aucune avance.</p>}
        </>
      )}

      {onglet === 'paies' && (
        <>
          <form onSubmit={enregistrerPaie} className={`${carte} space-y-3`}>
            <h2 className="font-bold">Nouvelle paie</h2>
            <div>
              <label className={etiquette}>Personne</label>
              <select className={champ} value={pT} onChange={(e) => choisirPersonne(e.target.value)} required>
                <option value="">Choisir…</option>
                {personnel.map((t) => <option key={t.id} value={t.id}>{t.nom} ({LIBELLE_PAIE[t.mode].toLowerCase()})</option>)}
              </select>
            </div>
            <div>
              <label className={etiquette}>Chantier (facultatif)</label>
              <select className={champ} value={pChantier} onChange={(e) => setPChantier(e.target.value)}>
                <option value="">Aucun (frais généraux)</option>
                {chantiers.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={etiquette}>Du</label><input className={champ} type="date" value={pDebut} onChange={(e) => setPDebut(e.target.value)} required /></div>
              <div><label className={etiquette}>Au</label><input className={champ} type="date" value={pFin} onChange={(e) => setPFin(e.target.value)} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={etiquette}>Quantité ({choisi ? UNITE_PAIE[choisi.mode] : 'jours / m² / tâches'})</label><input className={champ} inputMode="decimal" value={pQte} onChange={(e) => setPQte(e.target.value)} required /></div>
              <div><label className={etiquette}>Taux (FCFA)</label><input className={champ} inputMode="numeric" value={pTaux} onChange={(e) => setPTaux(e.target.value)} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={etiquette}>Avances à déduire{choisi && choisi.solde_avances > 0 ? ` (max ${fcfa(choisi.solde_avances)})` : ''}</label>
                <input className={champ} inputMode="numeric" value={pAvances} onChange={(e) => setPAvances(e.target.value)} />
              </div>
              <div><label className={etiquette}>Date de paiement</label><input className={champ} type="date" value={pDate} max={aujourdhui()} onChange={(e) => setPDate(e.target.value)} required /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pDepense} onChange={(e) => setPDepense(e.target.checked)} /> Enregistrer le coût comme dépense « main-d'œuvre »</label>
            {brut !== null && (
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt>Montant brut</dt><dd>{fcfa(brut)}</dd></div>
                {!Number.isNaN(Av) && Av > 0 && <div className="flex justify-between"><dt>Avances déduites</dt><dd>− {fcfa(Av)}</dd></div>}
                <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-bold"><dt>À remettre</dt><dd>{fcfa(Math.max(0, brut - (Number.isNaN(Av) ? 0 : Av)))}</dd></div>
              </dl>
            )}
            <button className={btn}>Enregistrer la paie</button>
          </form>
          {paies.map((p) => (
            <div key={p.id} className={`${carte} flex items-start justify-between gap-2`}>
              <div>
                <p className="font-semibold">{nomDe(p.travailleur_id)}</p>
                <p className="text-sm text-gray-500">
                  {dateFr(p.periode_debut)} → {dateFr(p.periode_fin)} · {qte(p.quantite)} {UNITE_PAIE[p.mode]} × {fcfa(p.taux)}
                </p>
                <p className="text-sm text-gray-500">{p.chantiers?.titre ?? 'Frais généraux'} · payé le {dateFr(p.date_paiement)}{p.avances_deduites > 0 && ` · avances déduites ${fcfa(p.avances_deduites)}`}</p>
              </div>
              <div className="text-right">
                <b>{fcfa(p.montant - p.avances_deduites)}</b>
                <p className="text-xs text-gray-500">brut {fcfa(p.montant)}</p>
                <button className="text-sm text-red-600" onClick={() => void supprimerPaie(p)}>Supprimer</button>
              </div>
            </div>
          ))}
          {!paies.length && <p className="text-center text-gray-500">Aucune paie enregistrée.</p>}
          {!personnel.length && <button className={btnSec} onClick={() => setOnglet('personnel')}>Ajouter d'abord du personnel</button>}
        </>
      )}
    </div>
  )
}
