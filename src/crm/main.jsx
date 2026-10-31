import React from 'react'
import ReactDOM from 'react-dom/client'
import CrmApp from './CrmApp'
// L'adresse officielle est /adstats ; /crm-next reste accepté (retour de connexion Google) puis bascule vers /adstats
// en gardant le reste de l'adresse (le jeton de connexion est dans la partie après le « ? » ou le « # »).
try { if (/^\/crm-next(\/|$)/.test(location.pathname) && !/localhost/.test(location.hostname)) history.replaceState(null, '', location.pathname.replace(/^\/crm-next/, '/adstats') + location.search + location.hash) } catch (_) {}
ReactDOM.createRoot(document.getElementById('root')).render(<CrmApp />)
