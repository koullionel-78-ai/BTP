import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
  const { session } = useAuth()
  const [inscription, setInscription] = useState(false)
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState('')
  const [info, setInfo] = useState('')
  const [envoi, setEnvoi] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function soumettre(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    setInfo('')
    setEnvoi(true)
    if (inscription) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: motDePasse,
        options: { data: { nom } },
      })
      if (error) setErreur(error.message)
      else if (!data.session) setInfo('Compte créé. Vérifiez votre e-mail pour le confirmer.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
      if (error) setErreur('E-mail ou mot de passe incorrect.')
    }
    setEnvoi(false)
  }

  const champ = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-3 outline-none focus:border-nuit'

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={soumettre} className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">{inscription ? 'Créer un compte' : 'Connexion'}</h1>
        {inscription && (
          <input className={champ} placeholder="Nom complet" value={nom} onChange={(e) => setNom(e.target.value)} required />
        )}
        <input className={champ} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={champ} type="password" placeholder="Mot de passe (6 caractères minimum)" minLength={6} value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required />
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        {info && <p className="text-sm text-green-700">{info}</p>}
        <button disabled={envoi} className="w-full rounded-lg bg-chantier py-3 font-bold text-nuit disabled:opacity-60">
          {envoi ? 'Patientez…' : inscription ? 'Créer le compte' : 'Se connecter'}
        </button>
        <button type="button" onClick={() => setInscription(!inscription)} className="w-full text-sm text-gray-600 underline">
          {inscription ? 'J’ai déjà un compte' : 'Créer un compte'}
        </button>
      </form>
    </div>
  )
}
