// patch_adboard_tp.cjs — TOP PERFORMER v2 DANS ADBOARD (16 nov. 2026)
// 1. « Top Performer » devient « Ajouter les données » : on donne les chiffres de n'importe quelle créative (ventes, dépenses, jours, ROAS, CPA, CTR), elle entre dans le classement.
// 2. Le classement est un vrai calcul : chaque chiffre comparé à la médiane des créatives de la même cible, pondéré, et ramené vers la moyenne quand il repose sur peu de ventes (topPerformer.js).
// 3. Fiche d'une créative : rang, indice (100 = moyenne de la cible) et fiabilité des données.
// Usage : node patch_adboard_tp.cjs [chemin vers src/Platform.jsx]   (idempotent ; s'arrête sans rien écrire si une ancre manque)
const fs = require('fs'), path = require('path');
const cible = process.argv[2] || path.join(process.cwd(), 'src', 'Platform.jsx');
if (!fs.existsSync(cible)) { console.error('Fichier introuvable : ' + cible); process.exit(1); }
let s = fs.readFileSync(cible, 'utf8');
if (s.includes('tp-v2-donnees')) { console.log('Déjà appliqué.'); process.exit(0); }
const crlf = s.includes('\r\n'); if (crlf) s = s.replace(/\r\n/g, '\n');
const ok = [];
const un = (old, label) => { const n = s.split(old).length - 1; if (n !== 1) { console.error('ANCRE ' + label + ' : ' + n + ' occurrence(s) au lieu de 1 — rien n\'est écrit.'); process.exit(2); } };
const remplace = (old, nouveau, label) => { un(old, label); s = s.replace(old, () => nouveau); ok.push(label); };
const regex = (re, nouveau, label) => { const m = s.match(new RegExp(re.source, 'g')); if (!m || m.length !== 1) { console.error('ANCRE ' + label + ' : ' + (m ? m.length : 0) + ' occurrence(s) au lieu de 1 — rien n\'est écrit.'); process.exit(2); } s = s.replace(re, () => nouveau); ok.push(label); };

// formulaire
remplace("{edition ? 'Chiffres de cette créative' : 'Marquer comme Top Performer'}", "{/* tp-v2-donnees */}Données de cette créative", 'titre formulaire');
remplace("Donnez ce que vous avez : <b style={{color:C.text}}>tout est facultatif</b>.", "Ventes, dépenses, jours de diffusion… donnez ce que vous avez : <b style={{color:C.text}}>plus il y a de chiffres, plus le classement de vos créatives est juste.</b>", 'intro formulaire');
regex(/<button data-testid="tp-enregistrer" disabled=\{busy\} onClick=\{onSave\} style=\{\{([^}]*?)cursor:busy\?'default':'pointer',fontFamily:'inherit',opacity:busy\?0\.6:1\}\}>/, `<button data-testid="tp-enregistrer" disabled={busy || !aDesValeurs} onClick={onSave} style={{$1cursor:(busy||!aDesValeurs)?'default':'pointer',fontFamily:'inherit',opacity:(busy||!aDesValeurs)?0.5:1}}>`, 'bouton enregistrer');
remplace("{busy ? 'Enregistrement…' : (edition ? 'Enregistrer' : (aDesValeurs ? 'Marquer avec ces chiffres' : 'Marquer sans chiffres'))}", "{busy ? 'Enregistrement…' : 'Enregistrer les données'}", 'libellé enregistrer');
remplace(">Retirer du Top Performer</button>", ">Retirer cette créative du classement</button>", 'retirer');
// notifications
regex(/notify && notify\(edition \? 'Chiffres enregistrés — classement mis à jour' : \(stats \? '[^']*' : 'Marquée Top Performer'\), 'success'\);/, "notify && notify('Données enregistrées — classement mis à jour', 'success');", 'notification enregistrer');
remplace("notify && notify('Retirée du Top Performer', 'success');", "notify && notify('Retirée du classement', 'success');", 'notification retirer');
// état vide
remplace("Aucune créative marquée pour ce produit", "Aucune créative classée pour ce produit", 'vide titre');
remplace("Ouvrez une créative dans « Tous » et touchez « Top Performer » dès qu'elle fonctionne.", "Ouvrez une créative dans « Tous » et touchez « Ajouter les données » : ventes, dépenses, jours de diffusion. Elle est classée automatiquement avec les autres créatives de la même cible.", 'vide texte');
// bouton de la fiche
regex(/<Icon name="star" size=\{15\} color=\{selected\.topPerformer\?'#FFC107':'#fff'\}\/>\{selected\.topPerformer \? \(aDesChiffres\(selected\) \? '[^']*' : '[^']*'\) : 'Top Performer'\}/, `<Icon name="chart" size={15} color={aDesChiffres(selected)?'#FFC107':'#fff'}/>{aDesChiffres(selected) ? 'Données · modifier' : 'Ajouter les données'}`, 'libellé bouton fiche');
remplace('aria-label="Top Performer">', 'aria-label="Données de la créative">', 'aria bouton');
remplace("borderColor:selected.topPerformer?'rgba(255,193,7,0.5)':'rgba(255,255,255,0.16)',background:selected.topPerformer?'rgba(255,193,7,0.14)':'rgba(255,255,255,0.07)',color:selected.topPerformer?'#FFC107':'#fff'}}", "borderColor:aDesChiffres(selected)?'rgba(255,193,7,0.5)':'rgba(255,255,255,0.16)',background:aDesChiffres(selected)?'rgba(255,193,7,0.14)':'rgba(255,255,255,0.07)',color:aDesChiffres(selected)?'#FFC107':'#fff'}}", 'style bouton');
// rang + indice + fiabilité dans la fiche
remplace("{selected.topPerformer && aDesChiffres(selected) && (", `{filterMode==='topPerformer' && scoresTP[selected.id] && scoresTP[selected.id].chiffre && groupeTP.length > 1 && (
              <div data-testid="viewer-rang" style={{fontSize:12,color:C.sec,lineHeight:1.5}}>
                <b style={{color:'#FFC107'}}>Classée n°{groupeTP.findIndex(x => x.id === selected.id) + 1} sur {groupeTP.length}</b>
                {scoresTP[selected.id].comparable ? <> · indice {scoresTP[selected.id].indice} <span style={{color:C.muted}}>(100 = moyenne de la cible)</span> · données {scoresTP[selected.id].fiabilite === 'solide' ? 'solides' : scoresTP[selected.id].fiabilite === 'moyenne' ? 'moyennes' : 'encore légères'}</> : null}
              </div>
            )}
            {selected.topPerformer && aDesChiffres(selected) && (`, 'rang fiche');
// pastille ventes sur la carte
regex(/(\{c\.tpStats\.cpa != null && <span style=\{\{[^}]*\}\}>CPA \{fmtTP\(c\.tpStats\.cpa\)\}<\/span>\})/, `$1
                      {c.tpStats.achats != null && <span style={{fontSize:9,fontWeight:700,color:'#fff',background:'rgba(0,0,0,0.65)',borderRadius:4,padding:'1px 5px'}}>{fmtTP(c.tpStats.achats)} vente{c.tpStats.achats > 1 ? 's' : ''}</span>}`, 'pastille ventes');
if (crlf) s = s.replace(/\n/g, '\r\n');
fs.copyFileSync(cible, cible + '.avant_tp');
fs.writeFileSync(cible, s);
console.log('OK — Platform.jsx corrigé (' + ok.length + ' remplacements ; sauvegarde : Platform.jsx.avant_tp).');
