document.addEventListener("click", function(e){
  const btn = e.target.closest(".skill-toggle");
  if(!btn) return;

  const card = btn.closest(".skill");
  if(!card) return;

  document.querySelectorAll(".skill.open").forEach(el => {
    if(el !== card) {
      el.classList.remove("open");
      const b = el.querySelector(".skill-toggle");
      if(b) b.textContent = "En savoir plus…";
    }
  });

  card.classList.toggle("open");
  btn.textContent = card.classList.contains("open") ? "Voir moins" : "En savoir plus…";
});
/* =========================
   CARTES (images) : galerie
   dossier = Cartes/
   ========================= */
(function () {
  const CARTES = [
    "Analyse surface urbaine te forestiere.png",
    "Carte bivariée Marseille.png",
    "Carte bivariée.jpg",
    "Carte de prédition.png",
    "Carte isochrone.jpg",
    "Densité-Batis.png",
    "Densité.jpg",
    "Departe de feu Alpes-de-Haute-Provence.jpg",
    "Hauteur des Batis-LST.png",
    "Indice ICU 3_2.png",
    "LST_2.png",
    "NDVI_2.png",
    "Part des revenues d'activité.png",
    "Taux de pauvreté.png",
    "Topo.jpg"
  ];

  const base = "Cartes/";
  const gallery = document.getElementById("galleryCartes");
  if (!gallery) return;

  function urlFor(name) {
    return base + encodeURIComponent(name).replace(/%2F/g, "/");
  }
  function titleFromFile(name) {
    return name.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  }

  CARTES.forEach(file => {
    const src = urlFor(file);
    const title = titleFromFile(file);

    const card = document.createElement("div");
    card.className = "w33 project carte-tile";
    card.innerHTML = `
      <img src="${src}" alt="${title}" loading="lazy">
      <h3>${title}</h3>
      <div class="actions">
        <button class="button btn-view" data-src="${src}" data-title="${title}">Voir</button>
        <a class="button" href="${src}" download>Télécharger</a>
      </div>
    `;
    gallery.appendChild(card);
  });

  // Modal
  const modal = document.getElementById("imgModal");
  const modalImg = document.getElementById("modalImg");
  const modalTitle = document.getElementById("modalTitle");
  const modalDownload = document.getElementById("modalDownload");
  const close1 = document.getElementById("modalClose");
  const close2 = document.getElementById("modalClose2");

  function openModal(src, title) {
    modalImg.src = src;
    modalImg.alt = title;
    modalTitle.textContent = title;
    modalDownload.href = src;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }
  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    modalImg.src = "";
  }

  gallery.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-view");
    if (!btn) return;
    openModal(btn.dataset.src, btn.dataset.title);
  });

  [close1, close2].forEach(b => b && b.addEventListener("click", closeModal));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
})();


// Données des documents (à adapter selon tes fichiers réels)
const documents = [
  {
    id: 1,
    titre: "Analyse de réseau",
    fichier: "analyse de reseau.pdf",
    categorie: "analyse",
    description: "Étude des réseaux de transport urbain"
  },
  {
    id: 2,
    titre: "Analyse des feux de forêt - Région de Lakoustk",
    fichier: "analyse des feux de foret dans la region de Lakoustk.pdf",
    categorie: "analyse",
    description: "Cartographie et analyse spatiale des incendies"
  },
  {
    id: 3,
    titre: "Morpho-émissivités urbaines à Kaunas",
    fichier: "analyse des morphoemissivites urbaines a Kaunas.pdf",
    categorie: "analyse",
    description: "Analyse thermique et urbaine"
  },
  {
    id: 4,
    titre: "Analyse des feux de forêt - Variables",
    fichier: "analyse feux foret var.pdf",
    categorie: "analyse",
    description: "Étude multivariée des facteurs d'incendie"
  },
  {
    id: 5,
    titre: "Cartographie - Analyse des phénomènes géographiques",
    fichier: "cartographie analyse des phenomenes geographiques.pdf",
    categorie: "sig",
    description: "Méthodes de représentation cartographique"
  },
  {
    id: 6,
    titre: "Dashboard BDR",
    fichier: "dashboard bdr.html",
    categorie: "dashboard",
    description: "Tableau de bord interactif"
  },
  {
    id: 7,
    titre: "Dossier SIG niveau avancé",
    fichier: "dossier a rendre sig niveau avancé.pdf",
    categorie: "sig",
    description: "Travaux pratiques avancés en SIG"
  },
  {
    id: 8,
    titre: "Dossier analyse spatiale",
    fichier: "dossier a rendre analyse spatiale.pdf",
    categorie: "sig",
    description: "Méthodes d'analyse géographique"
  },
  {
    id: 9,
    titre: "Mémoire de Master 1",
    fichier: "memoire_master_1.pdf",
    categorie: "memoire",
    description: "Travail de recherche M1"
  },
  {
    id: 10,
    titre: "Pollution et dégradation - Yamal",
    fichier: "pollution degradation yamal.pdf",
    categorie: "analyse",
    description: "Impact environnemental en Sibérie"
  },
  {
    id: 11,
    titre: "Rapport de stage - Licence 3",
    fichier: "Rapport_de_stage_licence_3.pdf",
    categorie: "memoire",
    description: "Stage de fin de licence"
  },
  {
    id: 12,
    titre: "Rendu Remote Sensing",
    fichier: "rendu remote sensing.pdf",
    categorie: "sig",
    description: "Travaux en télédétection"
  },
  {
    id: 13,
    titre: "Rendu Spatial Data Geoprocessing",
    fichier: "rendu spatial data geoprocessing.pdf",
    categorie: "sig",
    description: "Géotraitement de données"
  },
  {
    id: 14,
    titre: "Soutenance Master 1",
    fichier: "soutenance_master_1.pdf",
    categorie: "memoire",
    description: "Présentation orale du mémoire"
  }
];

// Fonction pour afficher les documents
function afficherDocuments(filtre = 'memoire') {
  const container = document.getElementById('docsList');
  if (!container) return;

  const docsFiltres = filtre === 'all' 
    ? documents 
    : documents.filter(doc => doc.categorie === filtre);

  container.innerHTML = docsFiltres.map(doc => `
    <div class="doc-card">
      <h3>${doc.titre}</h3>
      <p>${doc.description}</p>
      <div class="doc-actions">
        ${doc.fichier.endsWith('.html') 
          ? `<a href="docs/${doc.fichier}" class="button" target="_blank">Ouvrir</a>`
          : `<a href="docs/${doc.fichier}" class="button" target="_blank">Voir</a>`
        }
        <a href="docs/${doc.fichier}" class="button" download>Télécharger</a>
      </div>
    </div>
  `).join('');
}

// Gestion des filtres
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    // Retirer "active" de tous les boutons
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    // Ajouter "active" au bouton cliqué
    this.classList.add('active');
    // Afficher les documents filtrés
    const filtre = this.dataset.filter;
    afficherDocuments(filtre);
  });
});

// Affichage initial (mémoires par défaut)
afficherDocuments('memoire');

// Gestion du modal (si tu veux afficher des images)
const modal = document.getElementById('imgModal');
const modalClose = document.getElementById('modalClose');
const modalClose2 = document.getElementById('modalClose2');

if (modalClose) {
  modalClose.addEventListener('click', () => {
    modal.setAttribute('aria-hidden', 'true');
  });
}

if (modalClose2) {
  modalClose2.addEventListener('click', () => {
    modal.setAttribute('aria-hidden', 'true');
  });
}
