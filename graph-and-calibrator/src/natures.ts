const natures: {[nat_id: number]: { fr: string, en: string, description: string}} = {
    0: {
        fr: "Sans nature",
        en: "Unspecified",
        description: "No support type specified"
    },
    40: {
        fr: "Sémaphore",
        en: "Semaphore / Signal station",
        description: "Coastal or elevated signaling station, often used for navigation or surveillance"
    },
    41: {
        fr: "Phare",
        en: "Lighthouse",
        description: "Coastal lighthouse structure used for maritime navigation"
    },
    4: {
        fr: "Château d'eau - réservoir",
        en: "Water tower / reservoir",
        description: "Elevated water storage structure often used to host antennas"
    },
    38: {
        fr: "Immeuble",
        en: "Building (multi-storey)",
        description: "Multi-storey residential or commercial building"
    },
    39: {
        fr: "Local technique",
        en: "Technical room / equipment shelter",
        description: "Small technical building or shelter housing telecom equipment"
    },
    42: {
        fr: "Mât",
        en: "Mast",
        description: "Vertical pole structure used to support antennas"
    },
    8: {
        fr: "Intérieur galerie",
        en: "Inside gallery",
        description: "Installation inside a gallery or covered passage"
    },
    9: {
        fr: "Intérieur sous-terrain",
        en: "Underground interior",
        description: "Installation inside an underground structure"
    },
    10: {
        fr: "Tunnel",
        en: "Tunnel",
        description: "Installation inside a tunnel structure"
    },
    11: {
        fr: "Mât béton",
        en: "Concrete mast",
        description: "Mast made of reinforced concrete"
    },
    12: {
        fr: "Mât métallique",
        en: "Metal mast",
        description: "Mast made of steel or metal alloy"
    },
    21: {
        fr: "Pylône",
        en: "Tower",
        description: "Large vertical support structure for antennas"
    },
    17: {
        fr: "Bâtiment",
        en: "Building",
        description: "Standard building used as antenna support"
    },
    19: {
        fr: "Monument historique",
        en: "Historic monument",
        description: "Protected historical structure hosting antennas"
    },
    20: {
        fr: "Monument religieux",
        en: "Religious monument",
        description: "Religious building such as a church or cathedral"
    },
    22: {
        fr: "Pylône autoportant",
        en: "Self-supporting tower",
        description: "Tower standing without guy wires"
    },
    23: {
        fr: "Pylône autostable",
        en: "Free-standing tower",
        description: "Structurally stable tower without external support"
    },
    24: {
        fr: "Pylône haubané",
        en: "Guyed tower",
        description: "Tower stabilized using guy wires"
    },
    25: {
        fr: "Pylône treillis",
        en: "Lattice tower",
        description: "Tower made of a metal lattice framework"
    },
    26: {
        fr: "Pylône tubulaire",
        en: "Tubular tower",
        description: "Tower made of a hollow tubular structure"
    },
    31: {
        fr: "Silo",
        en: "Silo",
        description: "Agricultural or industrial storage silo used as a support"
    },
    32: {
        fr: "Ouvrage d'art (pont, viaduc)",
        en: "Engineering structure (bridge, viaduct)",
        description: "Large civil engineering structure such as a bridge or viaduct"
    },
    33: {
        fr: "Tour hertzienne",
        en: "Telecommunication tower",
        description: "Tower specifically designed for radio or microwave transmission"
    },
    34: {
        fr: "Dalle en béton",
        en: "Concrete slab",
        description: "Flat concrete base or platform supporting equipment"
    },
    999999999: {
        fr: "Support non décrit",
        en: "Undescribed support",
        description: "Support exists but is not described in the dataset"
    },
    43: {
        fr: "Fût",
        en: "Shaft / column",
        description: "Vertical column or shaft forming part of a larger structure"
    },
    44: {
        fr: "Tour de contrôle",
        en: "Control tower",
        description: "Control tower such as those used in airports or ports"
    },
    45: {
        fr: "Contre-poids au sol",
        en: "Ground counterweight",
        description: "Ballast placed on the ground to stabilize equipment"
    },
    46: {
        fr: "Contre-poids sur shelter",
        en: "Counterweight on shelter",
        description: "Ballast placed on top of an equipment shelter"
    },
    47: {
        fr: "Support DEFENSE",
        en: "Military / defense structure",
        description: "Structure belonging to military or defense infrastructure"
    },
    48: {
        fr: "pylône arbre",
        en: "Tree-disguised tower",
        description: "Tower designed to visually resemble a tree"
    },
    49: {
        fr: "Ouvrage de signalisation (portique routier, panneau routier)",
        en: "Signaling structure (gantry, road sign)",
        description: "Road or traffic signaling structure used to host equipment"
    },
    50: {
        fr: "Balise ou bouée",
        en: "Beacon or buoy",
        description: "Navigational beacon or floating buoy"
    },
    51: {
        fr: "XXX",
        en: "Unknown / placeholder",
        description: "Undefined or placeholder value in source data"
    },
    52: {
        fr: "Eolienne",
        en: "Wind turbine",
        description: "Wind power turbine structure occasionally used to host antennas"
    },
    55: {
        fr: "Mobilier urbain",
        en: "Street furniture",
        description: "Urban fixtures such as streetlights or traffic lights"
    }
};

export default natures;