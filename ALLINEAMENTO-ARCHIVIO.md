# Allineamento con Archivio-Canzoni

Confronto fra `canzoni/**/*.cho` e [CanzoniereOnLine/Archivio-Canzoni](https://github.com/CanzoniereOnLine/Archivio-Canzoni), i cui file `.tex` usano note inglesi (`\[G]`, `\[A-]` per il minore, `\[B&]` per il bemolle).

Canzoni locali: 127. Con corrispondenza in archivio: 87. Senza: 40.

## Metodo

Il testo di ogni coppia è ridotto a un flusso di parole normalizzate e allineato con `difflib`; ogni accordo è agganciato alla parola che lo contiene, così gli accordi a metà parola non spezzano l'allineamento. La trasposizione fra le due versioni è ricavata provando tutti i 12 semitoni e scegliendo quello che massimizza gli accordi concordi, quindi gli accordi sono confrontati nella tonalità locale.

La **concordanza** è la quota di posizioni in cui i due accordi coincidono dopo la trasposizione. Sopra 0.70 (58 canzoni) le due versioni condividono la stessa armonizzazione e le singole differenze valgono una verifica. Sotto 0.70 (29 canzoni) sono armonizzazioni diverse: elencare ogni accordo non sarebbe utile, quindi sono solo segnalate.

La **copertura** è la quota di parole dell'archivio ritrovate in locale, e serve a smascherare le corrispondenze sbagliate.

## 1. Scambi maggiore/minore

7 accordi condividono la fondamentale ma non il modo. È la differenza che più spesso indica un errore locale.

| File | Contesto | Archivio | Locale |
|---|---|---|---|
| `branco/tane_fredde.cho` | rispetta la legge per tutto | `Mim` | `Mi` |
| `chiesa/dove_troveremo_tutto_il_pane.cho` | io possiedo solo cinque pani | `Mi7` | `Mim` |
| `chiesa/e_sono_solo_un_uomo.cho` | nostro ad ogni figlio che | `Mim` | `Mi7` |
| `chiesa/gloria.cho` | agnello di dio figlio del | `Mi` | `Mim` |
| `chiesa/gloria.cho` | figlio del padre tu che | `Mi` | `Mim` |
| `chiesa/l_unico_maestro.cho` | mie mani con le tue | `Mim7` | `Mi` |
| `chiesa/l_unico_maestro.cho` | possono stringere perdonare e costruire | `Mim7` | `Mi` |

## 2. Altre differenze di accordi

202 differenze nelle canzoni con armonizzazione condivisa.

### `branco/cani_rossi.cho`  ←  `i_cani_rossi.tex` — archivio in Re-, locale trasposta di +7 semitoni, concordanza 0.82

| Contesto | Archivio | Locale |
|---|---|---|
| quando insieme noi senza paura | `Sol7` | `Sol` |
| l agguato ai nemici per gli | `Mi7` | `Mi` |

### `branco/tane_fredde.cho`  ←  `tane_fredde.tex` — archivio in Do, concordanza 0.79

| Contesto | Archivio | Locale |
|---|---|---|
| fatto un nuovo capo ora | `Sol` | `Mim` |
| oh oh noi siam furbe | `Sol` | `Do` |
| nella waingunga come un tuono | `Mi7` | `Do` |
| un tuono rimbombera bandar log il | `Do/Am` | `Lam` |
| la a lalala la la | `Fa` | `Lam` |

### `canti_scout/la_gioia.cho`  ←  `la_gioia.tex` — archivio in Do, concordanza 0.97

| Contesto | Archivio | Locale |
|---|---|---|
| ascolta il rumore delle | `Sol7` | `Fa` |

### `canti_scout/strade_e_pensieri_per_domani.cho`  ←  `strade_e_pensieri_per_domani.tex` — archivio in Sol, concordanza 0.96

| Contesto | Archivio | Locale |
|---|---|---|
| si fa sai ho voglia | `Re` | `Sol` |

### `chiesa/alleluia_chiama_e_io.cho`  ←  `alleluia_e_poi_diliberto.tex` — archivio in Do, concordanza 0.90

| Contesto | Archivio | Locale |
|---|---|---|
| silenzio mi accoglierai voce e | `Rem Sol` | `Re Sol` |
| tua parola camminero alleluia alleluia | `Rem Sol` | `Re Sol` |

### `chiesa/benedetto_tu_signore.cho`  ←  `benedetto_tu_signore_ricci.tex` — archivio in Do, locale trasposta di +9 semitoni, concordanza 0.75

| Contesto | Archivio | Locale |
|---|---|---|
| vita tua benedetto tu signore | `Mi4 Mi La` | `Mi La` |
| tu signore prendi da queste | `La Re` | `La Re La` |
| l eternita queste nostre offerte | `Re Mi` | `Mi` |
| offerte accoglile signore e saranno | `La` | `Re` |
| accoglile signore e saranno offerte | `Re Mi` | `Mi` |
| accogli o signore e saranno | `La` | `Re` |
| o signore e saranno cieli | `Re Mi` | `Mi` |
| tu signore prendi da queste | `La Re` | `La Re La` |
| la vita tua | `Mi` | `Re Mi La` |

### `chiesa/benedici_o_signore_nebbia_e_freddo.cho`  ←  `benedici_o_signore.tex` — archivio in Si-, locale trasposta di +10 semitoni, concordanza 0.92

| Contesto | Archivio | Locale |
|---|---|---|
| primo filo d erba e nel | `Fa7+` | `Fa` |
| offerta che portiamo a te | `Mi4` | `Mi` |

### `chiesa/come_la_pioggia_e_la_neve.cho`  ←  `ogni_mia_parola.tex` — archivio in Do, concordanza 0.82

| Contesto | Archivio | Locale |
|---|---|---|
| come la pioggia e la | `Sol` | `Fa` |
| non vi ritornano senza irrigare | `Sol` | `Mim` |
| ritornano senza irrigare e far | `Sol` | `Do` |
| ogni mia parola non ritornera | `Sol` | `Fa` |
| ogni mia parola 2 volte | `Sol Do` | `Sol` |

### `chiesa/dall_aurora_cerco_te.cho`  ←  `dall_aurora_al_tramonto.tex` — archivio in Do#-, concordanza 0.72

| Contesto | Archivio | Locale |
|---|---|---|
| ha sete solo di te | `Sol#m` | `Si` |
| delle tue ali dall aurora io | `Si4` | `Si` |
| contro di me dall aurora io | `Si4` | `Si` |
| ha sete solo di te | `Sol#m` | `Si` |
| te l anima mia come terra | `Mi` | `Do#m` |
| mia come terra deserta ha | `La` | `Sol#m` |
| come terra deserta ha sete | `Si Mi` | `La Si` |

### `chiesa/danza_la_vita.cho`  ←  `danza_la_vita.tex` — archivio in Re, concordanza 0.94

| Contesto | Archivio | Locale |
|---|---|---|
| senza stonature la verita del | `Re Sol` | `Re Sol Re` |
| stonature la verita del cuore | `Re` | `Sol` |

### `chiesa/dove_troveremo_tutto_il_pane.cho`  ←  `il_pane.tex` — archivio in Re, concordanza 0.75

| Contesto | Archivio | Locale |
|---|---|---|
| se non abbiamo niente io | `La7` | `La` |
| solo cinque pani io possiedo | `La7` | `La` |
| solo due pesci io possiedo | `La7` | `La` |
| un soldo soltanto io non | `La7` | `La` |
| io non possiedo niente dove | `La7` | `La` |

### `chiesa/e_sono_solo_un_uomo.cho`  ←  `e_sono_solo_un_uomo.tex` — archivio in Re, concordanza 0.80

| Contesto | Archivio | Locale |
|---|---|---|
| nella tua mano io mi | `La7` | `La` |
| di pregarti cosi padre di | `La4/7` | `La` |
| tu sei verita e imparero | `La7` | `La` |
| ogni figlio che diventa uomo | `Mi7 (A7)` | `La7` |
| che diventa uomo io lo | `La7 (D)` | `Re` |
| su di te e imparero | `La7` | `La` |
| si sente amato da nessuno | `Mi7 (A7)` | `La` |
| amato da nessuno | `La7 (D)` | `Re` |

### `chiesa/emmanuel.cho`  ←  `l_emmanuel.tex` — archivio in Mi, concordanza 0.77

| Contesto | Archivio | Locale |
|---|---|---|
| la verita da mille strade | `Si7 Mi Si` | `Mi Si` |
| voce e l emmanuel l emmanuel l emmanuel | `Si` | `Mi Si` |
| l emmanuel l emmanuel e l emmanuel l emmanuel | `Si7 Mi` | `Si7` |
| l emmanuel e l emmanuel l emmanuel dalla | `Si` | `Mi Si` |
| voce e l emmanuel l emmanuel l emmanuel | `Si` | `Mi Si` |
| l emmanuel l emmanuel e l emmanuel l emmanuel | `Si7 Mi` | `Si7` |
| l emmanuel e l emmanuel l emmanuel la | `Si` | `Mi Si` |

### `chiesa/giovane_donna.cho`  ←  `giovane_donna.tex` — archivio in Re, concordanza 0.92

| Contesto | Archivio | Locale |
|---|---|---|
| annuncio di novita a ve | `La` | `La4` |

### `chiesa/gloria.cho`  ←  `gloria_giombini.tex` — archivio in Do, concordanza 0.74

| Contesto | Archivio | Locale |
|---|---|---|
| ria a dio nell alto dei | `Mim` | `Sol` |
| ce in terra agli uomini | `Mim` | `Sol` |
| zie per la tua gloria | `Mim` | `Sol` |
| e nsa signore figlio unigenito | `Fa Sol Do Sol Do Fa Sol Do Sol Do Fa Sol Do Mim Lam Fa Do Sol Do Mi Lam` | `Mi Lam` |
| di noi abbi pieta di | `Re` | `Re7` |
| noi abbi pieta di noi | `Sol4` | `Sol` |
| nostra supplica tu che siedi | `Do` | `Lam` |
| siedi alla destra alla destra | `Sol` | `Mim` |
| di noi abbi pieta di | `Re` | `Re7` |
| di noi perche tu solo | `Do Sol Do Fa Sol Do Sol Do Fa Sol Do Mim Lam Fa Do Sol Do Do7 Fa` | `Fa` |
| nto nella gloria di dio | `Mim` | `Sol` |
| a men con lo spirito | `Fa Sol Do Do` | `Fa Sol Do` |
| nella gloria nella gloria di | `Fa Sol Do` | `Do` |
| gloria nella gloria di dio | `Mim` | `Sol` |
| pa dre nella gloria di | `Fa Sol Do` | `Do` |
| dre nella gloria di dio | `Mim` | `Sol` |

### `chiesa/il_canto_dell_amore.cho`  ←  `il_canto_dell_amore.tex` — archivio in Mi, locale trasposta di +10 semitoni, concordanza 0.82

| Contesto | Archivio | Locale |
|---|---|---|
| attraversare il deserto non temere | `Sim7` | `Sim` |
| camminare nel fuoco la sua | `Sim7` | `Sim` |
| nella notte sentirai la mia | `Re Mim` | `Mim` |
| il signore sono io che | `Sim7 Sol Re` | `Re` |
| io ti saro accanto saro | `Sim7` | `Sim` |
| io ti saro accanto saro | `Sim7` | `Sim` |

### `chiesa/il_disegno.cho`  ←  `il_disegno.tex` — archivio in La-, concordanza 0.71

| Contesto | Archivio | Locale |
|---|---|---|
| voce s alzo da una notte | `Mi7` | `Mi` |
| luce brillo dove non c era | `Mi7` | `Mi` |
| niente quel giorno avevi scritto | `Mi7` | `Mi` |
| lassu nel cielo avevi scritto | `Do` | `Do Mi` |
| nel cielo avevi scritto gia | `Mi7 Lam` | `Lam` |
| a te avevi scritto gia | `Mi7` | `Mi` |
| gia di me e quando | `Mi7` | `Mi` |
| incontrato te e la mia | `Mi7` | `Mi` |
| di me non cerchero piu | `Mi7` | `Mi` |
| me non cerchero piu niente | `Lam` | `Fa` |

### `chiesa/in_un_mondo_di_maschere.cho`  ←  `canto_dell_amicizia.tex` — archivio in Sol, concordanza 0.80

| Contesto | Archivio | Locale |
|---|---|---|
| in alto muovile al ritmo | `Do` | `Sim` |
| muovile al ritmo del canto | `Re` | `Do` |
| e scoprirai che e meno | `Do` | `Sim` |
| e meno duro il cammino | `Sol` | `Do` |

### `chiesa/luce.cho`  ←  `luce.tex` — archivio in Sol, concordanza 0.86

| Contesto | Archivio | Locale |
|---|---|---|
| dopo un lungo inverno nel | `Do` | `Lam` |
| ancora si luce fammi scoppiare | `Do Re` | `Do` |
| di vivere luce fammi strumento | `Do Re` | `Do` |
| a me luce e chi | `Do Re` | `Do` |
| te e luce voglio ringraziarti | `Do Re` | `Do` |

### `chiesa/pace_sia_pace_a_voi.cho`  ←  `pace_sia_pace_a_voi.tex` — archivio in Mi, locale trasposta di +10 semitoni, concordanza 0.93

| Contesto | Archivio | Locale |
|---|---|---|
| casa per tutti pace a | `La` | `La Re` |
| per tutti pace a voi | `Re Sol Re Sol` | `Sol Re Sol` |

### `chiesa/perfetta_letizia.cho`  ←  `perfetta_letizia.tex` — archivio in Re, concordanza 0.83

| Contesto | Archivio | Locale |
|---|---|---|
| frate inverno tra neve freddo | `Fa#m` | `Si` |
| casa e busseremo giu al | `Si` | `Sol#m` |
| cani ci prenderanno a bastonate | `Si` | `Sol#m` |
| sapremo pazientare bagnati stanchi e | `Si` | `Sol#m` |
| tu scrivi che questa e | `Si` | `Sol#m` |
| perfetta letizia perfetta letizia perfetta | `Mi` | `Si` |
| perfetta letizia perfetta letizia ah | `Si` | `La` |
| questa e frate leone questa | `Si` | `Sol#m` |
| questa e e perfetta letizia perfetta | `Mi Si` | `Sol#m` |

### `chiesa/rallegriamoci.cho`  ←  `rallegriamoci.tex` — archivio in Re, locale trasposta di +10 semitoni, concordanza 0.72

| Contesto | Archivio | Locale |
|---|---|---|
| rallegriamoci non c e | `Fa Do` | `Do` |
| rallegriamoci non c e spazio | `Sol` | `Fa` |
| questo giorno rallegriamoci e la | `Fa Do` | `Do` |
| giorno rallegriamoci e la vita | `Sol` | `Fa` |
| ogni paura rallegriamoci che si | `Fa Mim` | `Mim` |
| ogni promessa rallegriamoci ogni uomo | `Lam` | `Lam Fa` |
| torna la gioia 2v e | `Do Sol` | `Sol` |

### `chiesa/resta_qui_con_noi.cho`  ←  `resta_qui_con_noi.tex` — archivio in Re, concordanza 0.71

| Contesto | Archivio | Locale |
|---|---|---|
| dietro ai monti riflessi di | `Mim7` | `Mim` |
| di un giorno che ora | `Mi7` | `Mi` |
| ora correra sempre perche sappiamo | `La` | `Sol` |
| sempre perche sappiamo che una | `Fa#m7` | `Fa#m` |
| una nuova vita da qui | `Mim7` | `Mim` |
| scende gia resta qui con | `Mim7` | `Mim` |
| qui con noi signore e | `La` | `La7` |
| qui con noi il sole | `Fa#m7` | `Fa#m` |
| scende gia se tu sei | `Mim7` | `Mim` |

### `chiesa/santo_zaire.cho`  ←  `santo_zaire.tex` — archivio in Mi, locale trasposta di +10 semitoni, concordanza 0.83

| Contesto | Archivio | Locale |
|---|---|---|
| a nna osanna eh osanna | `Sol Re Re` | `Re` |
| osanna eh osanna eh osanna | `Sol` | `Re` |
| osanna eh osanna eh osanna | `Sol` | `Re` |
| osanna eh benedetto colui che | `Sol Re` | `Re` |
| osanna eh osanna eh osanna | `Sol` | `Re` |
| a cristo signor osanna eh | `Re Sol Re` | `Re` |

### `chiesa/te_al_centro_del_mio_cuore.cho`  ←  `te_al_centro_del_mio_cuore.tex` — archivio in Mi-, concordanza 0.86

| Contesto | Archivio | Locale |
|---|---|---|
| insieme a te unico riferimento | `Do7+` | `Do` |
| e il se che tu | `Re4` | `Re` |
| il se che tu splenda | `Re` | `Mim` |

### `chiesa/tu_sei.cho`  ←  `tu_sei.tex` — archivio in Do, concordanza 0.83

| Contesto | Archivio | Locale |
|---|---|---|
| la prima stella del mattino | `Rem7` | `Rem` |
| mattino tu sei la nostra | `Mim7` | `Mim` |
| nostalgia tu sei il cielo | `Mim7` | `Mim` |
| dopo la paura d esserci perduti | `Lam7` | `Lam` |
| in questo mare soffiera soffiera | `Sol Sol` | `Sol` |

### `clan/canto_di_marcia.cho`  ←  `carnet_di_marcia.tex` — archivio in Do, concordanza 0.80

| Contesto | Archivio | Locale |
|---|---|---|
| canneto osservo levarsi un vol | `Fa` | `Do` |

### `clan/e_la_strada_si_apre.cho`  ←  `e_la_strada_si_apre.tex` — archivio in Mi-, concordanza 0.88

| Contesto | Archivio | Locale |
|---|---|---|
| sull orizzonte di sera tutto di | `Do` | `Domaj7` |
| l amore il mondo vedra che | `Re4` | `Lam` |
| passo dopo passo ora su | `Do` | `Domaj7` |
| mondo che rinasce si puo | `Do` | `Domaj7` |
| puo vivere per l unita 2 | `Do` | `Lam7` |
| 2 volte nave che segue | `Re` | `Mim` |
| al mare usiamo allora queste | `Mi Lam` | `Re Sol Re Lam` |
| l amore il mondo vedra che | `Re4` | `Lam` |

### `clan/la_strada.cho`  ←  `la_strada_gaber.tex` — archivio in La, locale trasposta di +3 semitoni, concordanza 0.90

| Contesto | Archivio | Locale |
|---|---|---|
| ci nascondiamo bisogna ritornare per | `Do` | `Mim` |

### `clan/la_vita_e_per_volare.cho`  ←  `la_vita_e_per_volare.tex` — archivio in Re, concordanza 0.90

| Contesto | Archivio | Locale |
|---|---|---|
| il mondo sentieri non ce | `Sol` | `Fa#m` |
| rialzarsi in volo nell universo blu | `Re` | `Mi` |

### `clan/santa_maria_del_cammino.cho`  ←  `santa_maria_del_cammino.tex` — archivio in Do, concordanza 0.76

| Contesto | Archivio | Locale |
|---|---|---|
| solo tu non sei mai | `7` | `Sol7` |
| sei mai santa maria del | `7 Fa` | `Do7 Fa` |
| con te vieni o madre | `7 Fa` | `Do7 Fa` |
| noi vieni maria quaggiu cammineremo | `7` | `Sol7` |
| maria quaggiu cammineremo insieme a | `7 Fa` | `Do7 Fa` |

### `reparto/al_chiaror_del_mattin.cho`  ←  `al_chiaror_del_mattin.tex` — archivio in Sol, concordanza 0.75

| Contesto | Archivio | Locale |
|---|---|---|
| etempo di esitar se la | `Sol` | `Do Sol` |

### `reparto/canto_delle_squadriglie.cho`  ←  `canto_delle_squadriglie.tex` — archivio in Sol, concordanza 0.75

| Contesto | Archivio | Locale |
|---|---|---|
| i maccheroni sembran colla da | `Re7` | `Re` |

### `reparto/cavaliere_io_sarò.cho`  ←  `cavaliere_io_saro.tex` — archivio in Mi-, concordanza 0.90

| Contesto | Archivio | Locale |
|---|---|---|
| coraggio ci spingeranno gia ma | `Mim Re` | `Re` |
| il mio cavallo perche so | `Mim` | `Sol` |
| modo molto bello se si | `Mim` | `Sol` |

### `reparto/come_goccia_come_sole.cho`  ←  `come_sole_come_goccia.tex` — archivio in Sol, locale trasposta di +5 semitoni, concordanza 0.92

| Contesto | Archivio | Locale |
|---|---|---|
| che vorra risvegliarmi dal sonno | `Do` | `Lam` |
| lilla non riesco a stare | `Do` | `Lam` |

### `reparto/il_falco.cho`  ←  `il_falco.tex` — archivio in Do, locale trasposta di +2 semitoni, concordanza 0.90

| Contesto | Archivio | Locale |
|---|---|---|
| eha eha eha eha eh | `Re` | `La` |

### `reparto/tra_boschi_e_prati.cho`  ←  `canto_del_raid.tex` — archivio in La-, concordanza 0.90

| Contesto | Archivio | Locale |
|---|---|---|
| ancor piu meravigliosa perche la | `Do Lam` | `Do` |

### `varie/8_miliardi_di_persone.cho`  ←  `8_miliardi_di_persone.tex` — archivio in FA, concordanza 0.95

| Contesto | Archivio | Locale |
|---|---|---|
| tu mi parli | `Rem7 Re7 Rem7 Do Fa` | `Fa` |

### `varie/certe_notti.cho`  ←  `certe_notti.tex` — archivio in MI, concordanza 0.83

| Contesto | Archivio | Locale |
|---|---|---|
| quello che conta e sentire | `Si` | `Si4` |
| notti qui che chi s accontenta | `La` | `Sol#m La` |
| o non sarai sveglio mai | `Do#m` | `Fa#m` |
| prima o poi certe notti | `Re` | `Mi` |
| notti qui che chi s accontenta | `La` | `Sol#m La` |
| o le regaliamo a voi | `Do#m Sol#m` | `Fa#m Sol#m` |
| prima o poi certe notti | `Re` | `Mi` |
| notti qui che chi s accontenta | `La` | `Sol#m La` |
| o non sarai sveglio mai | `Do#m` | `Fa#m` |
| prima o poi certe notti | `Re` | `Mi` |
| certe notti qui | `Re Mi` | `Mi` |

### `varie/faccio_un_casino.cho`  ←  `faccio_un_casino.tex` — archivio in SOL, concordanza 0.80

| Contesto | Archivio | Locale |
|---|---|---|
| che potevo per te che | `Do` | `Si` |
| coi lego e cazzo e | `Do Do` | `Do` |
| senza salutare e senza fare | `Do Do` | `Do` |

### `varie/gli_anni.cho`  ←  `gli_anni.tex` — archivio in MI-, concordanza 0.81

| Contesto | Archivio | Locale |
|---|---|---|
| e poi va non lo | `Do` | `Mim` |
| un po e vedo i | `Do` | `Re` |
| fari delle auto che mi | `Re6` | `Re` |
| auto che mi guardano e | `Do7+` | `Do` |
| e sembrano chiedermi chi cerchiamo | `Re6` | `Re` |
| sembrano chiedermi chi cerchiamo noi | `Do7+` | `Do` |
| qui no i stessa storia stesso | `Re Do Re Sol` | `Re Sol Mim` |

### `varie/la_nuova_stella_di_broadway.cho`  ←  `la_nuova_stella_di_broadway.tex` — archivio in LA-, locale trasposta di +2 semitoni, concordanza 0.84

| Contesto | Archivio | Locale |
|---|---|---|
| businessman con un idea in testa | `Sol` | `Re` |
| vecchia cabriolet lei vestita come | `La` | `Re` |
| la rogers fulmini e saette | `Re` | `La` |
| lui si sveglio senza lei | `Sim` | `Sol` |
| vecchia cabriolet lei vestita come | `La` | `Re` |
| la rogers fulmini e saette | `Re` | `La` |

### `varie/missili.cho`  ←  `missili.tex` — archivio in Mim, concordanza 0.70

| Contesto | Archivio | Locale |
|---|---|---|
| quanto dobbiamo soffrire prima di | `Mim` | `Sim` |
| casco piu aspetta dai se | `Lam Mim` | `Lam` |
| parlo piu non ci servono | `Mim Mim` | `Mim` |
| sbaglio le strade poi ti | `Mim` | `Sim` |
| casco piu aspetta dai se | `Lam Mim` | `Lam` |
| casco piu aspetta dai se | `Lam Mim` | `Lam` |
| parlo piu mi hai fatto | `Lam` | `Sim` |
| parlo piu e adesso non | `Lam` | `Sim` |
| ti parlo piu | `Mim` | `Lam` |

## 3. Armonizzazioni divergenti

29 canzoni hanno concordanza sotto 0.70. Le due versioni sono arrangiate diversamente; confrontarle accordo per accordo non distingue errori da scelte.

| File | Archivio | Tonalità arch. | Traspos. | Concordanza | Copertura |
|---|---|---|---|---|---|
| `reparto/eirene.cho` | `eirene` | Mi | +10 | 0.67 | 0.99 |
| `clan/roverro.cho` | `roverro` | Mi- | +0 | 0.56 | 1.00 |
| `canti_scout/guendalina.cho` | `guendalina` | Sol | +3 | 0.54 | 0.98 |
| `reparto/signor_fra_le_tende_schierati.cho` | `signor_fra_le_tende` | Sol | +0 | 0.54 | 0.91 |
| `canti_scout/cenerentola.cho` | `cenerentola` | Mi | +2 | 0.53 | 0.95 |
| `varie/50_special.cho` | `50_special` | Sol | +0 | 0.52 | 0.96 |
| `chiesa/alleluia_passeranno_i_cieli.cho` | `alleluia_passeranno_i_cieli` | Re | +0 | 0.45 | 0.81 |
| `chiesa/canzone_semplice.cho` | `canzone_di_san_damiano` | Re- | +0 | 0.45 | 0.97 |
| `varie/perfect.cho` | `perfect` | Sol | +0 | 0.40 | 0.97 |
| `canti_scout/felicità.cho` | `felicita` | DO | +7 | 0.38 | 0.11 |
| `reparto/al_fuoco_di_bivacco.cho` | `al_fuoco_di_bivacco` | Do | +0 | 0.36 | 0.93 |
| `reparto/al_passo_del_guidon.cho` | `al_passo_del_guidon` | Do | +2 | 0.33 | 0.95 |
| `reparto/terra_di_betulla.cho` | `terra_di_betulla` | Mi- | +0 | 0.33 | 0.59 |
| `varie/poetica.cho` | `poetica` | Lam | +10 | 0.28 | 0.98 |
| `reparto/canto_dell_addio.cho` | `canto_dell_addio` | Fa | +2 | 0.25 | 0.77 |
| `varie/il_gatto_e_la_volpe.cho` | `il_gatto_e_la_volpe` | DO | +0 | 0.22 | 0.98 |
| `reparto/lazy_boy.cho` | `lazy_boy` | LA- | +0 | 0.21 | 0.72 |
| `chiesa/accogli_signore_i_nostri_doni.cho` | `accogli_i_nostri_doni_gen_verde` | Do | +0 | 0.17 | 0.97 |
| `reparto/dolce_sentire.cho` | `dolce_sentire` | Re | +10 | 0.12 | 1.00 |
| `reparto/madonna_degli_scout.cho` | `madonna_degli_scout` | Re- | +2 | 0.08 | 0.94 |
| `reparto/sul_cappello_un_bel_fior.cho` | `sul_cappello_un_bel_fior` | Fa | +2 | 0.07 | 0.93 |
| `chiesa/alleluia_di_lourdes.cho` | `alleluia_casucci` | Si- | +5 | 0.06 | 0.62 |
| `reparto/io_so_a_memoria_il_morse.cho` | `io_so_a_memoria_il_morse` | Sol | +0 | 0.05 | 0.99 |
| `branco/danza_della_fame_di_kaa.cho` | `danza_della_fame_di_kaa` | — | +0 | 0.00 | 0.39 |
| `chiesa/alleluia_taizé.cho` | `alleluia_come_parola` | Sol | +0 | 0.00 | 0.19 |
| `chiesa/mia_forza_mio_canto.cho` | `mia_forza_e_mio_canto_comi` | Mi- | +0 | 0.00 | 0.32 |
| `clan/canto_del_clan.cho` | `canto_del_clan` | — | +0 | 0.00 | 1.00 |
| `clan/un_mondo_una_promessa.cho` | `un_mondo_una_promessa` | Do | +0 | 0.00 | 0.68 |
| `clan/vado_in_route.cho` | `e_di_nuovo_route` | Mi- | +0 | 0.00 | 1.00 |

## 4. Differenze di testo

291 righe presenti in entrambe le versioni ma non identiche.

### `branco/attorno_alla_rupe.cho`

- archivio: d'Akela e Baloo or le voci ascoltiam
  - locale: di Akela e Baloo or le voci ascoltiam
- archivio: del lupo la forza del branco sarà.
  - locale: del lupo la forza nel branco sarà
- archivio: Uulla ullalala uullalala
  - locale: U-ullala ullala ullala la
- archivio: del lupo la forza nel branco sarà. (2 volte)
  - locale: del lupo la forza nel branco sarà
- archivio: a lui buona caccia si ripeterà. (2 volte)
  - locale: a lui buona caccia si ripeterà
- archivio: Il debole cucciolo via via crescerà
  - locale: Il debole cucciol via via crescerà
- archivio: la pelle striata del vile Shere Khan. (2 volte)
  - locale: la pelle striata del vile Shere Khan

### `branco/cani_rossi.cho`

- archivio: è deciso: su corriamo.
  - locale: È deciso: corriamo su corriamo.

### `branco/il_grido_del_pheeal.cho`

- archivio: Guarda duecento cani rossi e Mowgli lassù,
  - locale: Guarda 200 cani rossi e Mowgli lassù,
- archivio: nuota scodato è la Waingunga è sempre affamata.
  - locale: nuota scodato è la Waingunga: sempre affamata.
- archivio: s'alza e nessun dei cani rossi è rimasto quaggiù.
  - locale: s'alza e la nessun dei cani rossi è rimasto quaggiù;
- archivio: l'osso è stato stritolato si ritorna alle tane.
  - locale: l'osso è stato stritolato si ritorna alla tane.

### `branco/la_filastrocca_delle_vocali.cho`

- archivio: F quel furfante che in galera finirà.
  - locale: F quel furfante che in galera se ne va.
- archivio: Per G c'è tanta gente,
  - locale: G c'è tanta gente,
- archivio: Per H non c'è niente,
  - locale: H non c'è niente,
- archivio: N è Natale e tanti doni avrò.
  - locale: N è Natale e tanti doni io avrò.
- archivio: Per Q quel marmocchio che domani mangerò.
  - locale: per Q quel ranocchio che stasera mangerò,
- archivio: fanno le capriole e una storia sognerò.
  - locale: fanno capriole e nuove storie inventerò.

### `branco/tane_fredde.cho`

- archivio: Che mattino fortunato abbiam fatto un nuovo capo ora la giungla tremerà;
  - locale: Che mattino fortunato abbiam fatto un nuovo capo
- archivio: noi siam furbe, grandi, astute, dalla giungla siam temute adesso il nostro nome si udirà;
  - locale: noi siam furbe, grandi, astute, dalla giungla siam temute,
- archivio: Di soppiatto tra le foglie abbiam rapito il ranocchietto e “Bagheera, Mowgli non c'è più”;
  - locale: Di soppiatto tra le foglie abbiam rapito il ranocchietto
- archivio: ed ora vienici a cercare, tanto non ce la puoi fare, tane fredde ci nasconderan;
  - locale: ed ora vienici a cercare, tanto non ce la puoi fare,
- archivio: non c'è Legge che sconfigga questa verità, oggi la giungla tremerà.
  - locale: non c'è Legge che sconfigga questa verità,
- archivio: Ma Baloo e Bagheera sanno: quella forza è solo inganno e alla lotta si preparano di già;
  - locale: Ma Baloo e Bagheera sanno: quella forza è solo inganno
- archivio: nella giungla c'è un serpente che ipnotizza e poi ti stende. “Buona Caccia” tra le rocce si udirà.
  - locale: nella giungla c'è un serpente che ipnotizza e poi ti stende.

### `canti_scout/cenerentola.cho`

- archivio: Si sa, non è ancor nato chi goda l'avventura
  - locale: Si sa non è ancor nato chi gode all'avventura
- archivio: guardando il mondo dietro al buco della serratura!
  - locale: guardando il mondo dietro il buco della serratura,
- archivio: mi lascian qui, pazienza, non andrò alla festa,
  - locale: Mi lascian qui, pazienza... Allora non andrò alla festa."
- archivio: tornare buono a casa, far pure lui il mercante,
  - locale: tornare buono a casa e far pure lui il mercante
- archivio: Se tre caravelle, da mesi in mezzo al mare,
  - locale: Sele tre caravelle, da mesi in mezzo al mare,
- archivio: ``Maria, io qui ti lascio, quel che stato è stato!''
  - locale: "Maria, io qui ti lascio, quello che è stato è stato."
- archivio: non ci sarebbe al mondo, ti piaccia o non ti piaccia,
  - locale: Non ci sarebbe al mondo, vi piaccia o non vi piaccia,
- archivio: ben più di una persona mi ha detto che la vita,
  - locale: già più di una persona mi ha detto che la vita
- archivio: Vedi?, così va il mondo, a ognuno la sua arte,
  - locale: Vedi, così va il mondo, ognuno la sua arte.

### `canti_scout/colore_del_sole.cho`

- archivio: in te sorellina io vedo rispecchiar;
  - locale: in te sorellina vedo rispecchiar,
- archivio: segreti che sempre avrai nelle mani
  - locale: segreti che sempre avrai nelle mani in ogni tua sorte,
- archivio: famiglia felice oggi nel mondo poi su nel ciel
  - locale: Famiglia felice oggi nel mondo poi su nel ciel per sempre sarà...
- archivio: dov'è il tuo sentiero ti porta in un mondo ignoto
  - locale: dove il tuo sentiero si apre su un mondo ignoto
- archivio: che aspetta il tuo passo come di un cavaliere fidato;
  - locale: che attende il tuo passo come di un cavaliere fidato,
- archivio: dov'è il tuo pensiero dilata questa natura
  - locale: dove il tuo pensiero dilata questa natura
- archivio: verso l'avventura che ti farà capire te stessa
  - locale: verso l'avventura che ti farà capire te stesso e amar il Signor...
- archivio: il sangue che sgorga dal tuo cuor fratello rover;
  - locale: il sangue che sgorga dal cuor tuo fratello rover,

### `canti_scout/guendalina.cho`

- archivio: Guendalina, amore, amore mio,
  - locale: Guendalina, amore, amore
- archivio: senza di te, qua qua, mio Dio,
  - locale: la vita senza di te, qua qua, mio Dio,
- archivio: la vita mia che senso ha?
  - locale: mia che senso ha?

### `canti_scout/la_gioia.cho`

- archivio: ed il canto notturno dei mille pensieri dell'umanità
  - locale: ed il canto notturno di mille pensieri
- archivio: che di sera si incanta davanti al tramonto che il sole le dà.
  - locale: che di sera si incanta davanti al tramonto
- archivio: e cantare che ancora nascosta può esistere la felicità,
  - locale: cantare che ancora nascosta può esistere
- archivio: e puoi cantare e puoi sperare, perché ti han detto bugie
  - locale: e puoi gridare, perché ti han detto bugie
- archivio: ti han raccontato che l'hanno uccisa,
  - locale: se han raccontato che l' hanno uccisa,
- archivio: anche immerso nel frastuono tu falla sentire,
  - locale: anche immerso nel frastuono
- archivio: hai bisogno di gioia, come me.
  - locale: tu falla sentire, hai bisogno di gioia, come me.
- archivio: a gustar ancora per poco
  - locale: a gustar ancora un poco
- archivio: quest'aria scoperta stasera e domani ritorna,
  - locale: quest'aria scoperta stasera

### `canti_scout/scouting_for_boys.cho`

- archivio: scommetter sul mondo ma senza arroganze.
  - locale: scommetter sul mondo ma senza arroganza.
- archivio: pronti a partire rischiare la strada,
  - locale: e pronti a partire rischiare la strada
- archivio: Va' più in su, più in là contro vento
  - locale: Va' più in su, più in là
- archivio: sulle strade senza fare rumore
  - locale: sulle strade senza far rumore
- archivio: a chi in vita sua mai ha avuto parole.
  - locale: a chi in vita sua non ha mai avuto parole.

### `canti_scout/strade_e_pensieri_per_domani.cho`

- archivio: noi voi tutti vicini e lontani insieme si
  - locale: noi voi tutti vicini e lontani insieme si fa...
- archivio: Il corpo e le membra nell'unico amore insieme si
  - locale: Il corpo e le membra nell'unico amore
- archivio: se siamo solidi e solidali, insieme si
  - locale: se siamo solidi e solidali, insieme si fa...
- archivio: donne e uomini, non solo gente e insieme si
  - locale: donne e uomini, non solo gente
- archivio: Se dici pace, libero tutti insieme si
  - locale: Se dici pace, libero tutti insieme si fa...
- archivio: Sai, l'ha detto anche <<lascia il mondo
  - locale: Sai, l'ha detto anche B. P.: "Lascia il mondo
- archivio: Noi respiriamo verde avventura e insieme si
  - locale: Noi respiriamo verde avventura

### `chiesa/accogli_signore_i_nostri_doni.cho`

- archivio: tra la nostra povertà
  - locale: fra la nostra povertà

### `chiesa/alleluia_chiama_e_io.cho`

- archivio: Voce e la libertà,
  - locale: Voce e poi la libertà,
- archivio: Danza, ed io verrò con Te:
  - locale: Danza, ed io verrò da te:

### `chiesa/alleluia_di_lourdes.cho`

- archivio: Alleluia Alleluia Alleluia Alleluia
  - locale: Alleluia, alleluia, alleluia!

### `chiesa/alleluia_passeranno_i_cieli.cho`

- archivio: Alleluia, alleluia, alleluia,
  - locale: Alleluia alleluia a - lleluia alleluia
- archivio: alleluia, alleluia, alleluia, alleluia.
  - locale: Alleluia alleluia a - lleluia alleluia
- archivio: la Tua parola non passerà. Alleluia, alleluia.
  - locale: la Tua parola non passerà a - lleluia alleluia

### `chiesa/alleluia_taizé.cho`

- archivio: Come parola di vita,
  - locale: è parola di vita eterna.
- archivio: la tua parola Signore! (2 volte)
  - locale: La tua parola Signore
- archivio: Alleluia, Alleluia, Alleluia!
  - locale: Alleluia alleluia alleluuu--u--ia!

### `chiesa/benedici_o_signore_nebbia_e_freddo.cho`

- archivio: Nebbia e freddo, giorni lunghi e amari
  - locale: Nebbia e freddo, giorni lunghi e amari, mentre il seme muore.
- archivio: E nel vento dell'estate ondeggiano le spighe
  - locale: E nel vento dell’estate ondeggiano le spighe: avremo ancora pa – ne.
- archivio: questa offerta che portiamo a te
  - locale: Benedici o Signore questa offerta che portiamo a te
- archivio: Poi colori dell'autunno, coi grappoli maturi
  - locale: Poi i colori dell’autunno, coi grappoli maturi: avremo ancora vi – no.

### `chiesa/canzone_semplice.cho`

- archivio: Se vorrai, ogni giorno, con il tuo sudore,
  - locale: Se vorrai ogni giorno con il
- archivio: una pietra dopo l'altra alto arriverai.
  - locale: una pietra dopo l'altra alto
- archivio: Dai e dai, ogni giorno, con il tuo sudore,
  - locale: Dai e dai ogni giorno con il

### `chiesa/come_la_pioggia_e_la_neve.cho`

- archivio: Ogni mia Parola, ogni mia Parola
  - locale: ogni mia parola, ogni mia parola. (2 volte)

### `chiesa/dall_aurora_cerco_te.cho`

- archivio: Ha sete solo di te l'anima mia
  - locale: Ha sete solo di te
- archivio: come terra deserta. (2 volte)
  - locale: L'anima mia come terra deserta (2 volte)
- archivio: come terra deserta.
  - locale: L'anima mia come terra deserta

### `chiesa/danza_la_vita.cho`

- archivio: Canta e cammina
  - locale: Canta e cammina (2 volte)

### `chiesa/e_sono_solo_un_uomo.cho`

- archivio: ad ogni figlio che diventa uomo. (2 volte)
  - locale: ad ogni figlio che diventa uomo
- archivio: che non si sente amato da nessuno. (2 volte)
  - locale: che non si sente amato da nessuno

### `chiesa/emmanuel.cho`

- archivio: la veri
  - locale: la Verità
- archivio: È l'Emmanuel, Emmanuel.
  - locale: È l'Emmanuel l'Emmanuel
- archivio: Un grande dono che Dio che ci ha fatto
  - locale: Un grande dono che Dio ci ha fatto
- archivio: di chi la storia sa cambiare come Gesù.
  - locale: di chi la storia sa cambiare
- archivio: nuovo per ricominciare,
  - locale: per ricominciare,
- archivio: per dire al mondo, ad ogni uomo, Signore Gesù.
  - locale: per dire al mondo, ad ogni uomo:

### `chiesa/giovane_donna.cho`

- archivio: Giovane donna, attesa dell'umanità,
  - locale: Giovane donna attesa dall'umanità,
- archivio: ed il suo amore ti avvolgerà con la sua ombra.
  - locale: ed il suo amore t'avvolgerà con la sua ombra.

### `chiesa/gloria.cho`

- archivio: A Dio nell'alto dei cieli! Gloria!
  - locale: a Dio nell'alto dei cieli Glo - o - ria.
- archivio: Noi ti lodiamo, (ti lodiamo)
  - locale: Noi ti lodiamo (noi ti lodiamo),
- archivio: per la tua gloria immensa!
  - locale: per la tua gloria imme - e - nsa.
- archivio: Con lo Spirito Santo
  - locale: Con lo Spirito
- archivio: nella gloria di Dio Padre. Amen!
  - locale: nella gloria di Dio Padre. A - a - men.

### `chiesa/il_disegno.cho`

- archivio: Nel mare del silenzio una voce si alzò,
  - locale: Nel mare del silenzio una voce s’alzò,
- archivio: e quando hai disegnato il cammino di ogni uomo,
  - locale: e quando hai disegnato il cammino d’ogni uomo,

### `chiesa/in_un_mondo_di_maschere.cho`

- archivio: e scoprirai che è meno duro il cammino così.
  - locale: che è meno duro il cammino così.

### `chiesa/l_unico_maestro.cho`

- archivio: ad amare come hai fatto tu con me.
  - locale: e insegnami ad amare come hai fatto tu con me.

### `chiesa/luce.cho`

- archivio: C'è il segreto della libertà quella vera nasce dentro di te.
  - locale: C'è il segreto della libertà quella vera, batte dentro di te,
- archivio: È come risvegliarsi un mattino con il sole dopo un lungo inverno
  - locale: come risvegliarsi un mattino col sole, dopo un lungo inverno.
- archivio: Fammi strumento per portare attorno a me luce
  - locale: Fammi strumento per portare intorno a me... Luce!
- archivio: con la speranza nel cuore e la tua luce in me paura non ho più.
  - locale: con la speranza nel cuore e la mia luce in Te paura non ho più.

### `chiesa/mia_forza_mio_canto.cho`

- archivio: Chi è come te, o Signore?
  - locale: chi è come te Signore
- archivio: Chi è come te fra gli dei?
  - locale: Chi è come te tra gli dei o Signore
- archivio: il popolo che tu hai riscattato.
  - locale: Guidasti il popolo che hai riscattato
- archivio: e con amore alla tua santa dimora.
  - locale: lo conducesti alla tua santa dimora

### `chiesa/pace_sia_pace_a_voi.cho`

- archivio: sulla terra com'è nei cieli.
  - locale: sulla terra come nei cieli.
- archivio: che sale dalle nostre città.
  - locale: che sale nelle nostre città.

### `chiesa/perfetta_letizia.cho`

- archivio: o far vedere i ciechi e i morti camminare
  - locale: e far vedere i ciechi e i morti camminare...
- archivio: e possa ammansire i lupi e farli amici come cani;
  - locale: e possa ammansire i lupi e farli amici come i cani,
- archivio: per quanto anche all'inferno lui possa far cristiani
  - locale: per quanto anche all'inferno lui pssa far cristiani...

### `chiesa/rallegriamoci.cho`

- archivio: Rallegriamoci, non c'è spazio alla tristezza in questo giorno,
  - locale: non c'è spazio alla tristezza in questo giorno.
- archivio: Rallegriamoci, è la vita che distrugge ogni paura
  - locale: è la vita che distrugge ogni paura.
- archivio: Rallegriamoci, che si compie in questo giorno la promessa
  - locale: che si compie in questo giorno ogni promessa.
- archivio: e torna la gioia. (2 volte)
  - locale: (e torna la gi - o - ia.) (2^ volta)
- archivio: (e torna la gioia.)
  - locale: e torna la gioia! (2v)
- archivio: Rallegriamoci, Egli viene a liberarci da ogni male.
  - locale: Egli viene a liberarci da ogni male.
- archivio: Rallegriamoci, è il momento di gustare il suo perdono,
  - locale: è il momento di gustare il suo perdono.
- archivio: rallegriamoci, con coraggio riceviamo la sua vita,
  - locale: con coraggio riceviamo la sua vita.
- archivio: Rallegriamoci, tutti i popoli del mondo lo vedranno
  - locale: tutti i popoli del mondo lo vedranno.
- archivio: rallegriamoci, nel Signore è la nostra dignità.
  - locale: nel Signore è la nostra dignità.
- archivio: Rallegriamoci, nella luce del suo regno in cui viviamo,
  - locale: nella luce del suo regno in cui viviamo.

### `chiesa/santo_zaire.cho`

- archivio: Santo Santo Osanna
  - locale: Santo, Santo. Osa - a - nna
- archivio: Osanna a Cristo Signor
  - locale: Osanna a Cristo Signor (Osanna eh)
- archivio: I cieli e la terra, o Signore, sono pieni di te.
  - locale: I cieli e la terra o Signore

### `clan/canto_del_clan.cho`

- archivio: Vieni a cantare: è la canzon del clan.
  - locale: Ohè, ohè, vieni a cantare, è la canzon del Clan.

### `clan/canto_di_marcia.cho`

- archivio: Guardo nei campi brulli le stoppie aride
  - locale: Guardo nei campi brulli le stoppie
- archivio: e nel canneto osservo levarsi un vol.
  - locale: Se nel canneto osservo levarsi
- archivio: Mi chiedo che fanno queste cose intorno:
  - locale: Mi chiedo che fanno queste
- archivio: è un sogno, un inganno, questa vita accanto a me?
  - locale: è un sogno o un inganno questa vita
- archivio: Sei tu, Signor, che ti nascondi:
  - locale: Sei Tu Signor che mi
- archivio: La mia tendina chiara spicca tra gli alberi,
  - locale: La mia tendina chiara spicca tra
- archivio: nella radura erbosa mi scaldo il the.
  - locale: nella radura erbosa declina il di.
- archivio: Trattiene il respiro ogni cosa intorno,
  - locale: Trattiene il respiro ogni cosa
- archivio: il fuoco che miro mi raccoglie tutto a sé.
  - locale: il fuoco che miro raccoglie tutto
- archivio: Sei tu, Signor, che mi circondi:
  - locale: Sei Tu Signor che mi
- archivio: che vuoi da me?
  - locale: circondi che vuoi da me
- archivio: Marcio con zaino in spalla per valli insolite.
  - locale: Marcio con zaino in spalla per valli
- archivio: Divido il pane e l'acqua con un fratel.
  - locale: divido il pane e l'acqua con il fratel.
- archivio: le cose in cui credo son concrete accanto a me.
  - locale: le cose in cui credo sono concrete
- archivio: Sei tu, Signor, che mi rispondi:
  - locale: Sei Tu Signor che mi

### `clan/e_la_strada_si_apre.cho`

- archivio: solo scegliendo l'amore il mondo ve
  - locale: solo scegliendo l'amore il mondo vedrà...

### `clan/il_coraggio_nei_piedi.cho`

- archivio: Come Giuseppe che era solo un falegname
  - locale: che era solo un falegname
- archivio: Come Maria che era libera di andare
  - locale: che era libera di andare
- archivio: Come Francesco che ha lasciato la sua casa
  - locale: che ha lasciato la sua casa,
- archivio: Come Sophie che non si è fatta spaventare
  - locale: che non si è fatta spaventare
- archivio: Come Peppino che ha deciso di parlare
  - locale: che ha deciso di parlare
- archivio: E come me, un po' fragile e un po' forte
  - locale: un po’ fragile, un po’ forte
- archivio: di esser lì dove Tu sei.
  - locale: di essere lì dove Tu sei…
- archivio: lì dove mi chiedi
  - locale: lì dove mi chiedi (x4)

### `clan/la_strada.cho`

- archivio: c'è solo la voglia e il bisogno di uscire
  - locale: c’è sola la voglia il bisogno di uscire
- archivio: di esporsi nella strada e nella piazza
  - locale: di esporsi sulla strada e sulla piazza
- archivio: bisogna ritornare nella strada
  - locale: bisogna ritornare per la strada
- archivio: e gli angeli non danno appuntamento
  - locale: E gli angeli non danno appuntamenti
- archivio: e anche nelle case più spaziose
  - locale: neanche nelle case più spaziose
- archivio: non c'è spazio per verifica e confronto.
  - locale: non c’è spazio per verifiche e confronti
- archivio: dalla lotta dal dolore e dalle bombe.
  - locale: dalla lotta, dal dolore, dalle bombe.

### `clan/roverro.cho`

- archivio: Di cercare l'avventura, ripartire ogni giorno ed esser
  - locale: Di cercare l’avventura, ripartire ogni giorno ed

### `clan/strade_di_coraggio.cho`

- archivio: diritti al futuro sulle strade
  - locale: dritti al futuro sulle strade della nostra vita.
- archivio: vediamo in lontananza una stella brillare
  - locale: vediamo in lontanananza una stella brillare

### `clan/un_mondo_una_promessa.cho`

- archivio: questo tempo costruito insieme,
  - locale: Questo tempo costruito insieme, di noia non ce n'è...
- archivio: con la legge che è la stessa.
  - locale: Un grande cerchio con la legge che è la stessa
- archivio: noi fratelli, noi uguali, noi fratelli, noi uguali
  - locale: noi diversi, noi lontani, noi fratelli, noi uguali …

### `reparto/al_chiaror_del_mattin.cho`

- archivio: non è tempo di esitar!
  - locale: non ètempo di esitar.
- archivio: E se il vento verrà, e se il vento verrà,
  - locale: Se la neve verra', se la neve verrà
- archivio: e tutto muoverà, e tutto muoverà,
  - locale: e tutto muovera' e tutto bagnerà.

### `reparto/al_fuoco_di_bivacco.cho`

- archivio: Sempre avanti esploratrici (esploratori),
  - locale: Sempre avanti esploratori,
- archivio: sempre in alto i nostri cuori (i nostri cuori).
  - locale: sempre in alto i nostri cuori.
- archivio: e cantiamo sempre così: Jamboree!
  - locale: e cantiamo sempre così:

### `reparto/al_passo_del_guidon.cho`

- archivio: Al passo del guidon, fratello scout t'attende l'avventura
  - locale: La fratello scout, t'attende l'avventura
- archivio: tra il verde delle macchie e sotto il
  - locale: tra il verde delle macchie e sotto il sol.
- archivio: un nido, un'erba, un fior t'aspetta ed è tutto per te.
  - locale: un nido, un'erba, un fior t'aspetta ed è
- archivio: Apri l'occhio fratello scout,
  - locale: Apri gli occhi fratello scout
- archivio: Al lato del sentier, la pista ancor, fratel, non è battuta
  - locale: la pista ancor fratel, non è battuta,
- archivio: la bussola ti guida senza er
  - locale: la bussola ti guida senza error…
- archivio: Al lato del sentier il mondo è tutta terra sconosciuta:
  - locale: il mondo è tutta terra sconosciuta;
- archivio: ma certo c'è un amico che di là ti aspetterà.
  - locale: ma certo c'è un amico che di là
- archivio: Al fuoco del falò la gioia dei fratelli è la più pura
  - locale: la gioia dei fratelli è la più pura;
- archivio: fa un unica gran tenda il vasto
  - locale: Fa un'unica gran tenda il vasto ciel…
- archivio: la voce che ci vuole esplorator sul nostro onor!
  - locale: la Voce che ci vuol esplorator

### `reparto/canto_dell_addio.cho`

- archivio: È l'ora dell'addio, fratelli, è l'ora di partir,
  - locale: È l’ora dell’addio, fratelli,
- archivio: Arrivederci allor, fratelli, arrivederci, sì.
  - locale: arrivederci allor, fratelli,

### `reparto/canto_della_promessa.cho`

- archivio: Dinanzi a voi mi impegno sul mio onor
  - locale: Dinnanzi a voi m’impegno sul mio onor

### `reparto/canto_delle_squadriglie.cho`

- archivio: ulla ila ila ila ilao la la la!
  - locale: Ullaì ullaò ulla ì la ì la ì la ì laò la la la la.

### `reparto/cavaliere_io_sarò.cho`

- archivio: e così cercherò un modo molto bello se si può
  - locale: e così io cercherò un modo molto bello se si può

### `reparto/come_goccia_come_sole.cho`

- archivio: Risvegliarmi dal sonno e attirare il mio sguardo
  - locale: risvegliarmi dal sonno e attirare il mio sguardo verso quel bel prato la'.
- archivio: Non riesco a stare fermo, devo uscire a guardare
  - locale: Non riesco a stare fermo devo uscire a guardare è già troppo che aspetto qua.
- archivio: lascia a casa soltanto la tristezza che hai dentro
  - locale: lascia a casa soltanto la tristezza che hai dentro e vedrai che passerà.
- archivio: ma se sai far uscire la sorgente che hai dentro
  - locale: me se sai far uscire la sorgente che hai dentro niente più ti fermerà.
- archivio: Provo a alzare gli occhi, quanta gente vedo intorno a me.
  - locale: Provo ad alzare gli occhi, tanta gente vedo intorno a me
- archivio: Ma se sto seduto, gli altri partiranno senza me
  - locale: Ma se sto seduto questi partiranno senza me

### `reparto/e_sorto_il_sole_esplorator.cho`

- archivio: è sorto il sole, esplorator,
  - locale: È sorto il sol, esplorator,
- archivio: Ritorna al tuo lavoro,
  - locale: Ritorna al tuo lavoro che
- archivio: che grande gioia ti dà;
  - locale: grande gioia ti dà.

### `reparto/eirene.cho`

- archivio: il bosco dorme e Tu lassù ancora
  - locale: il bosco dorme e Tu lassù ancor

### `reparto/il_falco.cho`

- archivio: Fiumi mari e boschi senza confine
  - locale: Fiumi, boshi e mari senza confine,
- archivio: i chiari orizzonti e le verdi colline
  - locale: i chiari orizzonti, le verdi colline.
- archivio: Fiumi mari e boschi mossi dal vento
  - locale: Fiumi, boschi e mari mossi dal vento,
- archivio: luna su luna i miei capelli d'argento
  - locale: lune su lune, i miei capelli d’argento.
- archivio: ma no, non è morto, era solo ferito.
  - locale: ma non era morto, era solo ferito.

### `reparto/io_so_a_memoria_il_morse.cho`

- archivio: che sono entrato negli scout.
  - locale: che sono entrato negli scaout
- archivio: gli scarponcini sul comò
  - locale: gli scarponini sul comò
- archivio: e la mia scuola è a 30 gradi est
  - locale: e la mia scuola è a trenta gradi est

### `reparto/lazy_boy.cho`

- archivio: Un dì la mamma gli disse "Vai,
  - locale: Un dì la mamma gli disse va,
- archivio: ma resta un bravo cowboy.
  - locale: ma resta un bravo cow boy,
- archivio: Gabriele la suonerà".
  - locale: Daniele la suonerà .

### `reparto/oleanna.cho`

- archivio: Ole oleanna, vecchia terra del far west,
  - locale: vecchia terra del Far -Wes t
- archivio: tutta io vorrei per me.
  - locale: tutta ti vorrei per me.
- archivio: Ole oleanna, ole oleanna-na!
  - locale: Ole -oleanna, ole -olean -na -na.
- archivio: ole ole ole ole ole oleanna-na!
  - locale: Ole -ole -ole -ole -ole -ole -an -na -na.
- archivio: non ne hai che da succhiar.
  - locale: tu non hai che da succhiar.
- archivio: Ole oleanna sei rimasta nel mio cuor,
  - locale: sei rimasta nel mio cuor,
- archivio: sei la terra dove in cielo
  - locale: sei la terra dove il cielo

### `reparto/pende_un_uomo.cho`

- archivio: Pa-zum, pappa-zum,
  - locale: Pa zum! Pa pa zum!
- archivio: Pa-pa-pa-pa-pa zack!
  - locale: pa pa pa pa pa zach!
- archivio: stan tre scheletri a giocare.
  - locale: stan tre scheletri a ballare

### `reparto/signor_fra_le_tende_schierati.cho`

- archivio: Signor fra le tende schierati
  - locale: Signor tra le tende schierati
- archivio: Chiedon sol tutti i nostri cuori a te
  - locale: Chiedon sol tutti i nostri cuori
- archivio: sempre meglio servir,
  - locale: a te sempre meglio servir,

### `reparto/sul_cappello_un_bel_fior.cho`

- archivio: Questo solo ci vuol per un bravo esplorator
  - locale: questo sol ci vuol per un bravo esplorator,

### `reparto/terra_di_betulla.cho`

- archivio: là dove errando va il lupo ancor.
  - locale: Là, dove errando va il lupo ancora
- archivio: Il cuore mio nostalgico là nelle terre basse
  - locale: Il mio cuore nostalgico là nelle basse terre
- archivio: vuol ritornare a voi, monti del Nord.
  - locale: vuole tornare a voi monti del nord

### `reparto/tra_boschi_e_prati.cho`

- archivio: ancor più meravigliosa per
  - locale: ancor più meravigliosa perché ...
- archivio: Un sorso d'acqua ancora e poi
  - locale: Un sorso d'acqua fresca e poi
- archivio: ci fermerem col morir del sole
  - locale: ci fermeremo col morir del sole
- archivio: per poi star dinnanzi al fuoco
  - locale: per poi star davanti al fuoco
- archivio: di una notte con la luna
  - locale: in una notte con la luna
- archivio: portarci fortuna.
  - locale: portarci la fortuna.
- archivio: testimone di fatiche di chi
  - locale: testimone delle fatiche di chi ...

### `varie/50_special.cho`

- archivio: La scuola non va,
  - locale: E la scuola non va
- archivio: ma una Vespa, una donna non ho ho
  - locale: ma ho una Vespa, una donna non ho
- archivio: una Vespa domenica è già
  - locale: ho una Vespa e domenica è già
- archivio: e una Vespa mi porte
  - locale: e una Vespa mi porterà...

### `varie/8_miliardi_di_persone.cho`

- archivio: che potrei scriverti a occhi chiusi come il mio nome
  - locale: Che potrei scriverti a occhi chiusi
- archivio: Stavo cercando di vederti in mezzo
  - locale: Stavo cercando di vederti in mezzo a
- archivio: a tutta questa folla
  - locale: tutta questa folla
- archivio: Dovrei tornare a casa adesso
  - locale: Dovrei tornare a casa adesso ma
- archivio: ma se non ci sei non ne ho voglia
  - locale: se non ci sei non ne ho voglia
- archivio: Perché ho problemi di attenzione ben oltre la media
  - locale: Perché ho problemi di attenzione

### `varie/certe_notti.cho`

- archivio: che quello che conta è sentire che vai
  - locale: ma quello che conta è sentire che vai
- archivio: e nebbia e locali a cui dai del tu
  - locale: e nebbia e loali a cui dai del tu
- archivio: che chi s'accontenta gode così così
  - locale: che chi s'accontenta gode

### `varie/faccio_un_casino.cho`

- archivio: E ho rotto tutto quello che potevo per te,
  - locale: E ho rotto tutto quello che potevo
- archivio: Era meglio se non ti conoscevo
  - locale: Era meglio se non ti conosce

### `varie/gli_anni.cho`

- archivio: e vedo i fari delle auto che mi
  - locale: esco un po', e vedo i fari delle auto che mi
- archivio: guardano e sembrano chiedermi
  - locale: guardano e sembrano chiedermi chi cerchiamo noi
- archivio: gli anni del tranquillo siam qui noi
  - locale: Gli anni del "Tranquillo, siam qui no-------i"
- archivio: siamo qui noi
  - locale: "siamo qui no-------i
- archivio: una coppia che conosco ci avrà la mia età
  - locale: una coppia che conosco c’avran la mia età
- archivio: come va salutano così io
  - locale: come va, salutano
- archivio: vedo le fedi alle dita di due
  - locale: così io, vedo le fedi alle dita dei due
- archivio: solo lei davanti a me cosa vuoi
  - locale: solo lei, davanti a me
- archivio: il tempo passa per tutti lo sai
  - locale: cosa vuoi, il tempo passa per tutti lo sai

### `varie/il_gatto_e_la_volpe.cho`

- archivio: ci ascolti per momento, capirai,
  - locale: Se ci ascolti per un momento capirai.
- archivio: migliori in questo campo, siamo noi
  - locale: i migliori in questo campo siamo noi
- archivio: una ditta specializzata, un contratto e vedrai
  - locale: è una ditta specializzata, fa un contratto e vedrai
- archivio: Noi scopriamo talenti e non sbagliamo sol
  - locale: Noi scopriamo talenti e non sbagliamo mai
- archivio: di avere due consulenti
  - locale: di avere due consulenti due impresari,

### `varie/la_nuova_stella_di_broadway.cho`

- archivio: Lui era un business-man, con un'idea in testa,
  - locale: Lui era un businessman con un'idea in testa
- archivio: Guardando quelle gambe muoversi pensò: "È una stella!". Pensava a Fred Astaire
  - locale: Guardando quelle gambe muoversi pensò: "È una stella!"
- archivio: lei, vestita come la Rogers, fulmini e saette,
  - locale: Lei, vestita come la Rogers
- archivio: lassù, nel cielo blu, il loro nome.
  - locale: Nel cielo blu, il loro nome

### `varie/missili.cho`

- archivio: Senza navigatore eh
  - locale: Senza navigatore

### `varie/perfect.cho`

- archivio: Darling just dive right in, and follow my lead
  - locale: Darling, just dive right in, and
- archivio: Well I found a girl beautiful and sweet
  - locale: Well, I found a girl beautiful and
- archivio: I never knew you were the someone waiting for me
  - locale: I never knew you were the someone
- archivio: Not knowing what it was, I will not give you up this time
  - locale: Not knowing what it was, I will not
- archivio: And in your eyes you're holding mine
  - locale: And in your eyes you're holding
- archivio: But you heard it, darling you look perfect tonight
  - locale: But you heard it, darling you look
- archivio: Well I found a woman, stronger than anyone I know
  - locale: Well, I found a woman, stronger than
- archivio: I found a love, to carry more than just my secrets
  - locale: I found a love, to carry more than
- archivio: To carry love, to carry children of our own
  - locale: To carry love, to carry children of
- archivio: I know that we'll be alright this time
  - locale: I know we'll be alright this ti-me
- archivio: I see my future in your eyes
  - locale: I see my future in your
- archivio: In person, and she looks perfect
  - locale: In person, and she looks

### `varie/poetica.cho`

- archivio: che si infrangono su di noi
  - locale: Che s'infrangono su di noi
- archivio: tutte quelle cose che ho mandato già in fumo
  - locale: Di tutte quelle cose che ho mandato già in fumo
- archivio: colpa della solitudine non l'ho mai detto a nessuno
  - locale: Per colpa della solitudine non l'ho mai detto a nessuno
- archivio: se sai che non è finita abbracciami
  - locale: Se lo sai che non è finita, abbracciami
- archivio: Abbracciami Abbracciami
  - locale: Abbracciami, abbracciami, abbracciami
- archivio: Troveremo il modo anche quando poi saremo stanchi
  - locale: E anche quando poi saremo stanchi

## 5. Righe presenti solo in archivio

91 righe dell'archivio senza riscontro locale. Molte sono marcatori (`Rit.`) o code strumentali, altre sono strofe mancanti.

### `branco/danza_della_fame_di_kaa.cho`

- Lentamente va il pitone delle rocce, sono Kaa.
- Lentamente va, la mia danza è questa qua, Bandar Log!

### `branco/tane_fredde.cho`

- Laila lalala lala! Laila lalala lala!

### `canti_scout/colore_del_sole.cho`

- in ogni tua sorte;
- per sempre sarà.
- e amare il Signor.

### `canti_scout/felicità.cho`

- Felicità, è tenersi per mano, andare lontano la felicità,
- è il tuo sguardo innocente in mezzo alla gente la felicità,
- è restare vicini, come bambini, la felicità, felicità.
- Felicità, è un cuscino di piume, l'acqua del fiume che passa e che va,
- è abbassare la luce, per fare pace, la felicità, felicità.
- è lasciarsi un biglietto dentro al cassetto, la felicità,
- è cantare a due voci, quanto mi piaci la felicità, felicità.
- Senti nell'aria c'è già la nostra canzone d'amore che va,
- Senti nell'aria c'è già un raggio di sole più caldo che va,
- Felicità, è una sera a sorpresa, la luna accesa, la radio che va,
- è un biglietto d'auguri, pieno di cuori la felicità,
- è una telefonata non aspettata, la felicità, felicità.
- Felicità, è una spiaggia di notte, l'onda che batte, la felicità,
- è una mano sul cuore, piena d'amore la felicità,
- è aspettare l'aurora, per farlo ancora la felicità, felicità.

### `canti_scout/la_gioia.cho`

- la, la, la, la, la la la, la, la la la lalla la la la la la (2 volte)
- fra la gente corre e che spera, tu saprai che
- nascosta nel cuore può esistere la felicità,

### `canti_scout/scouting_for_boys.cho`

- è lotta dura ma tendi lo spago

### `chiesa/alleluia_taizé.cho`

- come acqua tra le dita,
- mi sostiene mi consola
- fino al tuo ritorno! (2 volte)

### `chiesa/benedici_o_signore_nebbia_e_freddo.cho`

- mentre il seme muore.
- del primo filo d'erba.
- avremo ancora pane.
- Benedici, o Signore,
- avremo ancora vino.

### `chiesa/danza_la_vita.cho`

- Rit.

### `chiesa/emmanuel.cho`

- Emmanuel.
- Rit.

### `chiesa/gloria.cho`

- Gloria! Gloria!

### `chiesa/mia_forza_mio_canto.cho`

- perché lui è il mio Salvatore.
- e lo schiaccia con vittoria infinita.
- Il faraone in cuor suo diceva,
- li inseguirò e li raggiungerò.
- Ma col tuo soffio alzasti le acque
- perché il tuo popolo attraversasse il mare.
- Soffiasti ancora e il mare ricoprì
- il faraone e il suo potere.
- Cavalli e carri e tutti i cavalieri
- furono sommersi nel profondo del mare.

### `chiesa/perfetta_letizia.cho`

- ci prenderanno a bastonate e al freddo toccherà aspettare

### `chiesa/rallegriamoci.cho`

- rallegriamoci, ogni uomo lo vedrà: la salvezza di Dio.

### `chiesa/resta_qui_con_noi.cho`

- i riflessi di un giorno che non finirà,

### `clan/e_la_strada_si_apre.cho`

- un mondo che rinasce

### `clan/strade_di_coraggio.cho`

- della nostra vita.

### `reparto/al_chiaror_del_mattin.cho`

- per avere il Sol basta ridere

### `reparto/canto_dell_addio.cho`

- uniamoci l'un l'altro prima di tornar lontan.

### `reparto/canto_delle_squadriglie.cho`

- Ullai ullao

### `reparto/come_goccia_come_sole.cho`

- verso quel bel prato là.
- è già troppo che aspetto qua.
- Poi diventa un quadrifoglio se lo curerai.
- e vedrai che passerà.
- niente più ti fermerà.
- se saremo almeno in tre”.

### `reparto/lazy_boy.cho`

- è la gran stella del vecchio Texas, la stella dei cowboys.
- Così comincia la lunga storia di un pallido cowboy.
- e un brutto giorno conobbe Jessie, conobbe la sua colt.
- Ai passeggeri bucò i sombreri, rubò pepite d'or.
- ma ad una spanna trovò la canna del pallido cowboy.

### `reparto/pende_un_uomo.cho`

- Un cadavere inchiodato
- alla prua sottovento:
- è un ribelle che ha pagato
- Sulla cassa posta a poppa
- Come premio c'è una coppa
- ch'era il teschio del compare.

### `reparto/terra_di_betulla.cho`

- Bum di di ai di ,
- bum di di ai di bum (2 volte)
- Là tra gli abeti la luna appare.
- Mamma, il tuo viso rivedo ancora.

### `varie/faccio_un_casino.cho`

- E tu a giocare sei brava davvero, ma non con me.
- Dimmi cos'è che vuoi da me
- Lo sai che c'è,
- Pronto, cos'è che c'hai, sei presa male, ah
- Hai rotto un altro cellulare
- Cosa mi chiami solo se stai male
- Ho casa nuova e devo sistemare
- Non sarò l'ultimo né il primo
- E a parte tutto eri brava davvero,
- ma non con me.

### `varie/gli_anni.cho`

- esco un po'
- chi cerchiamo noi

### `varie/il_gatto_e_la_volpe.cho`

- due impresari, che si fanno

### `varie/la_nuova_stella_di_broadway.cho`

- la felicità.

### `varie/perfect.cho`

- I don't deserve this, darling you look perfect tonight

## 6. Metadati disponibili in archivio

Autore assente in locale, presente in archivio: 7.

| File | Autore archivio |
|---|---|
| `canti_scout/strade_e_pensieri_per_domani.cho` | Mattia Civico |
| `chiesa/alleluia_di_lourdes.cho` | Casucci, Balduzzi |
| `chiesa/alleluia_passeranno_i_cieli.cho` | Costa, Varnavà |
| `clan/roverro.cho` | Alessandro Intonti |
| `clan/santa_maria_del_cammino.cho` | D'Andrea |
| `clan/vado_in_route.cho` | Francesco Brandi |
| `reparto/al_passo_del_guidon.cho` | A. Mazzocolin, E. Demattè |

Autore discordante: 10.

| File | Locale | Archivio |
|---|---|---|
| `canti_scout/felicità.cho` | Silver | Albano |
| `chiesa/alleluia_chiama_e_io.cho` | Luca Diliberto e Giuliana Monti | Luca Diliberto, Giuliana Monti |
| `chiesa/alleluia_taizé.cho` | Taizé | Paolo Sartore |
| `chiesa/canzone_semplice.cho` | p. Jean-Marie Benjamin e Donovan | Ortolani |
| `chiesa/dall_aurora_cerco_te.cho` | Mite Balduzzi e Chiara Casucci | Casucci, Balduzzi |
| `chiesa/giovane_donna.cho` | Luciano Scaglianti e Liliana Bancolini | Scaglianti, Bancolini |
| `chiesa/luce.cho` | Alessandro Gallo (Reale) | Comunità del Cenacolo |
| `clan/strade_di_coraggio.cho` | Clan Modena 4 e Modena 7 | Marco Lodi, Marco Costantini |
| `clan/un_mondo_una_promessa.cho` | Gian Vittorio e Irene Pula | Gianvittorio Pula |
| `reparto/signor_fra_le_tende_schierati.cho` | p. Jacques Sevin | Savin |

## 7. Corrispondenze da verificare

6 corrispondenze hanno copertura sotto 0.60 e potrebbero essere abbinamenti sbagliati.

| Copertura | File | Archivio | Titolo archivio |
|---|---|---|---|
| 0.11 | `canti_scout/felicità.cho` | `felicita` | Felicità |
| 0.19 | `chiesa/alleluia_taizé.cho` | `alleluia_come_parola` | Alleluia, come parola |
| 0.32 | `chiesa/mia_forza_mio_canto.cho` | `mia_forza_e_mio_canto_comi` | Mia forza e mio canto |
| 0.39 | `branco/danza_della_fame_di_kaa.cho` | `danza_della_fame_di_kaa` | Danza della fame di Kaa |
| 0.39 | `varie/faccio_un_casino.cho` | `faccio_un_casino` | Faccio un casino |
| 0.59 | `reparto/terra_di_betulla.cho` | `terra_di_betulla` | Terra di betulla |

## 8. Canzoni senza corrispondenza

40 canzoni locali non hanno riscontro. L'archivio raccoglie repertorio liturgico e scout, quindi il pop di `varie/` è quasi tutto assente.

- `branco/canto_della_morte_di_akela.cho`
- `branco/con_un_filo.cho`
- `branco/cucciolo_d_uomo.cho`
- `branco/la_notte_piu_lunga.cho`
- `branco/la_stagione_della_caccia.cho`
- `branco/la_tigre_zoppa.cho`
- `canti_scout/cowboy_piero.cho`
- `canti_scout/john_brown.cho`
- `chiesa/alleluia_delle_lampadine.cho`
- `chiesa/alleluia_di_gen_verde.cho`
- `chiesa/alleluia_servire_e.cho`
- `chiesa/beati_color.cho`
- `chiesa/cristo_è_risorto_alleluia.cho`
- `chiesa/grande_dio_dell_universo.cho`
- `chiesa/salga_a_te_signore.cho`
- `clan/fedeli_e_ribelli.cho`
- `reparto/era_di_notte.cho`
- `reparto/estote_parati.cho`
- `reparto/giona.cho`
- `reparto/l_uomo_di_cromagnon.cho`
- `reparto/la_leggenda_del_fuoco.cho`
- `varie/2minuti.cho`
- `varie/alta_marea.cho`
- `varie/autograph.cho`
- `varie/buon_viaggio.cho`
- `varie/che_colpa_ne_ho.cho`
- `varie/controtempo.cho`
- `varie/destri.cho`
- `varie/fiore_mio.cho`
- `varie/forever_young.cho`
- `varie/gli_occhi.cho`
- `varie/idem.cho`
- `varie/io_non_piango.cho`
- `varie/la_metà_della_mela.cho`
- `varie/le_luci_della_città.cho`
- `varie/nessuna.cho`
- `varie/nonono.cho`
- `varie/sally.cho`
- `varie/scale.cho`
- `varie/senza_parole.cho`

## 9. Elenco completo delle corrispondenze

| File | Archivio | Tonalità arch. | Traspos. | Concordanza | Copertura |
|---|---|---|---|---|---|
| `branco/attorno_alla_rupe.cho` | `attorno_alla_rupe` | La- | +0 | 1.00 | 0.84 |
| `branco/cani_rossi.cho` | `i_cani_rossi` | Re- | +7 | 0.82 | 1.00 |
| `branco/danza_della_fame_di_kaa.cho` | `danza_della_fame_di_kaa` | — | +0 | 0.00 | 0.39 |
| `branco/il_grido_del_pheeal.cho` | `il_grido_del_pheeal` | Mi- | +0 | 1.00 | 0.98 |
| `branco/la_filastrocca_delle_vocali.cho` | `ninnananna_dell_alfabeto` | La | +5 | 1.00 | 0.88 |
| `branco/tane_fredde.cho` | `tane_fredde` | Do | +0 | 0.79 | 0.97 |
| `branco/ulula_alla_luna.cho` | `ulula_alla_luna` | Do | +0 | 1.00 | 1.00 |
| `canti_scout/cenerentola.cho` | `cenerentola` | Mi | +2 | 0.53 | 0.95 |
| `canti_scout/colore_del_sole.cho` | `canto_delle_branche` | La | +0 | 1.00 | 0.95 |
| `canti_scout/felicità.cho` | `felicita` | DO | +7 | 0.38 | 0.11 |
| `canti_scout/guendalina.cho` | `guendalina` | Sol | +3 | 0.54 | 0.98 |
| `canti_scout/insieme.cho` | `insieme` | Re | +0 | 1.00 | 1.00 |
| `canti_scout/la_gioia.cho` | `la_gioia` | Do | +0 | 0.97 | 0.90 |
| `canti_scout/scouting_for_boys.cho` | `pronti_a_servire` | Do | +0 | 1.00 | 0.98 |
| `canti_scout/strade_e_pensieri_per_domani.cho` | `strade_e_pensieri_per_domani` | Sol | +0 | 0.96 | 1.00 |
| `chiesa/accogli_signore_i_nostri_doni.cho` | `accogli_i_nostri_doni_gen_verde` | Do | +0 | 0.17 | 0.97 |
| `chiesa/alleluia_chiama_e_io.cho` | `alleluia_e_poi_diliberto` | Do | +0 | 0.90 | 0.98 |
| `chiesa/alleluia_di_lourdes.cho` | `alleluia_casucci` | Si- | +5 | 0.06 | 0.62 |
| `chiesa/alleluia_passeranno_i_cieli.cho` | `alleluia_passeranno_i_cieli` | Re | +0 | 0.45 | 0.81 |
| `chiesa/alleluia_taizé.cho` | `alleluia_come_parola` | Sol | +0 | 0.00 | 0.19 |
| `chiesa/benedetto_tu_signore.cho` | `benedetto_tu_signore_ricci` | Do | +9 | 0.75 | 0.99 |
| `chiesa/benedici_o_signore_nebbia_e_freddo.cho` | `benedici_o_signore` | Si- | +10 | 0.92 | 0.99 |
| `chiesa/canzone_semplice.cho` | `canzone_di_san_damiano` | Re- | +0 | 0.45 | 0.97 |
| `chiesa/come_la_pioggia_e_la_neve.cho` | `ogni_mia_parola` | Do | +0 | 0.82 | 1.00 |
| `chiesa/dall_aurora_cerco_te.cho` | `dall_aurora_al_tramonto` | Do#- | +0 | 0.72 | 1.00 |
| `chiesa/danza_la_vita.cho` | `danza_la_vita` | Re | +0 | 0.94 | 0.78 |
| `chiesa/dove_troveremo_tutto_il_pane.cho` | `il_pane` | Re | +0 | 0.75 | 1.00 |
| `chiesa/e_sono_solo_un_uomo.cho` | `e_sono_solo_un_uomo` | Re | +0 | 0.80 | 0.98 |
| `chiesa/emmanuel.cho` | `l_emmanuel` | Mi | +0 | 0.77 | 0.97 |
| `chiesa/giovane_donna.cho` | `giovane_donna` | Re | +0 | 0.92 | 0.92 |
| `chiesa/gloria.cho` | `gloria_giombini` | Do | +0 | 0.74 | 0.90 |
| `chiesa/il_canto_dell_amore.cho` | `il_canto_dell_amore` | Mi | +10 | 0.82 | 1.00 |
| `chiesa/il_disegno.cho` | `il_disegno` | La- | +0 | 0.71 | 0.97 |
| `chiesa/in_un_mondo_di_maschere.cho` | `canto_dell_amicizia` | Sol | +0 | 0.80 | 1.00 |
| `chiesa/l_unico_maestro.cho` | `l_unico_maestro` | La- | +0 | 0.90 | 1.00 |
| `chiesa/luce.cho` | `luce` | Sol | +0 | 0.86 | 0.96 |
| `chiesa/mia_forza_mio_canto.cho` | `mia_forza_e_mio_canto_comi` | Mi- | +0 | 0.00 | 0.32 |
| `chiesa/pace_sia_pace_a_voi.cho` | `pace_sia_pace_a_voi` | Mi | +10 | 0.93 | 0.96 |
| `chiesa/perfetta_letizia.cho` | `perfetta_letizia` | Re | +0 | 0.83 | 0.96 |
| `chiesa/rallegriamoci.cho` | `rallegriamoci` | Re | +10 | 0.72 | 0.97 |
| `chiesa/resta_qui_con_noi.cho` | `resta_qui_con_noi` | Re | +0 | 0.71 | 0.99 |
| `chiesa/santo_zaire.cho` | `santo_zaire` | Mi | +10 | 0.83 | 0.98 |
| `chiesa/servo_per_amore.cho` | `servo_per_amore` | Si- | +5 | 1.00 | 0.99 |
| `chiesa/te_al_centro_del_mio_cuore.cho` | `te_al_centro_del_mio_cuore` | Mi- | +0 | 0.86 | 1.00 |
| `chiesa/tu_sei.cho` | `tu_sei` | Do | +0 | 0.83 | 1.00 |
| `clan/canto_del_clan.cho` | `canto_del_clan` | — | +0 | 0.00 | 1.00 |
| `clan/canto_di_marcia.cho` | `carnet_di_marcia` | Do | +0 | 0.80 | 0.87 |
| `clan/e_la_strada_si_apre.cho` | `e_la_strada_si_apre` | Mi- | +0 | 0.88 | 0.99 |
| `clan/il_coraggio_nei_piedi.cho` | `il_coraggio_nei_piedi` | Mi | +10 | 1.00 | 0.82 |
| `clan/la_strada.cho` | `la_strada_gaber` | La | +3 | 0.90 | 0.77 |
| `clan/la_vita_e_per_volare.cho` | `la_vita_e_per_volare` | Re | +0 | 0.90 | 1.00 |
| `clan/roverro.cho` | `roverro` | Mi- | +0 | 0.56 | 1.00 |
| `clan/santa_maria_del_cammino.cho` | `santa_maria_del_cammino` | Do | +0 | 0.76 | 1.00 |
| `clan/strade_di_coraggio.cho` | `strade_di_coraggio` | Do | +0 | 1.00 | 0.99 |
| `clan/un_mondo_una_promessa.cho` | `un_mondo_una_promessa` | Do | +0 | 0.00 | 0.68 |
| `clan/vado_in_route.cho` | `e_di_nuovo_route` | Mi- | +0 | 0.00 | 1.00 |
| `reparto/al_chiaror_del_mattin.cho` | `al_chiaror_del_mattin` | Sol | +0 | 0.75 | 0.85 |
| `reparto/al_fuoco_di_bivacco.cho` | `al_fuoco_di_bivacco` | Do | +0 | 0.36 | 0.93 |
| `reparto/al_passo_del_guidon.cho` | `al_passo_del_guidon` | Do | +2 | 0.33 | 0.95 |
| `reparto/canto_dell_addio.cho` | `canto_dell_addio` | Fa | +2 | 0.25 | 0.77 |
| `reparto/canto_della_promessa.cho` | `canto_della_promessa` | Re | +2 | 1.00 | 0.96 |
| `reparto/canto_delle_squadriglie.cho` | `canto_delle_squadriglie` | Sol | +0 | 0.75 | 0.89 |
| `reparto/cavaliere_io_sarò.cho` | `cavaliere_io_saro` | Mi- | +0 | 0.90 | 1.00 |
| `reparto/come_goccia_come_sole.cho` | `come_sole_come_goccia` | Sol | +5 | 0.92 | 0.93 |
| `reparto/dolce_sentire.cho` | `dolce_sentire` | Re | +10 | 0.12 | 1.00 |
| `reparto/e_sorto_il_sole_esplorator.cho` | `sul_colle_scorre_il_ruscello` | Fa | +0 | 1.00 | 0.97 |
| `reparto/eirene.cho` | `eirene` | Mi | +10 | 0.67 | 0.99 |
| `reparto/il_falco.cho` | `il_falco` | Do | +2 | 0.90 | 0.94 |
| `reparto/io_so_a_memoria_il_morse.cho` | `io_so_a_memoria_il_morse` | Sol | +0 | 0.05 | 0.99 |
| `reparto/lazy_boy.cho` | `lazy_boy` | LA- | +0 | 0.21 | 0.72 |
| `reparto/madonna_degli_scout.cho` | `madonna_degli_scout` | Re- | +2 | 0.08 | 0.94 |
| `reparto/oleanna.cho` | `oleanna` | Re | +10 | 1.00 | 0.77 |
| `reparto/pende_un_uomo.cho` | `pende_un_uomo` | La- | +0 | 1.00 | 0.61 |
| `reparto/signor_fra_le_tende_schierati.cho` | `signor_fra_le_tende` | Sol | +0 | 0.54 | 0.91 |
| `reparto/sul_cappello_un_bel_fior.cho` | `sul_cappello_un_bel_fior` | Fa | +2 | 0.07 | 0.93 |
| `reparto/terra_di_betulla.cho` | `terra_di_betulla` | Mi- | +0 | 0.33 | 0.59 |
| `reparto/tra_boschi_e_prati.cho` | `canto_del_raid` | La- | +0 | 0.90 | 0.95 |
| `varie/50_special.cho` | `50_special` | Sol | +0 | 0.52 | 0.96 |
| `varie/8_miliardi_di_persone.cho` | `8_miliardi_di_persone` | FA | +0 | 0.95 | 0.90 |
| `varie/certe_notti.cho` | `certe_notti` | MI | +0 | 0.83 | 0.98 |
| `varie/faccio_un_casino.cho` | `faccio_un_casino` | SOL | +0 | 0.80 | 0.39 |
| `varie/gli_anni.cho` | `gli_anni` | MI- | +0 | 0.81 | 0.97 |
| `varie/il_gatto_e_la_volpe.cho` | `il_gatto_e_la_volpe` | DO | +0 | 0.22 | 0.98 |
| `varie/la_nuova_stella_di_broadway.cho` | `la_nuova_stella_di_broadway` | LA- | +2 | 0.84 | 0.99 |
| `varie/missili.cho` | `missili` | Mim | +0 | 0.70 | 0.98 |
| `varie/perfect.cho` | `perfect` | Sol | +0 | 0.40 | 0.97 |
| `varie/poetica.cho` | `poetica` | Lam | +10 | 0.28 | 0.98 |
