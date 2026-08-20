# Sources to "An Empirical Study on Free Space Optical Backhaul"

- Line-of-Sight (LoS) availability: [LoS-Checker](los-checker)
- Graph visualization: [Website](graph-and-calibrator)
- Calibrator to measure position data quality: [Website](graph-and-calibrator)
- Building snapper to improve position data quality: [Snapping](snapping)

Live demo: https://cellfso.web.app

Cell site locations and LoS-results used in the paper are located in [graph-and-calibrator/public/data](graph-and-calibrator/public/data). They are based on [Données sur les installations radioélectriques de plus de 5 watts](https://www.data.gouv.fr/datasets/donnees-sur-les-installations-radioelectriques-de-plus-de-5-watts-1) and supplemented with terrain elevation data by [IGN RGE ALTI](https://www.data.gouv.fr/datasets/rge-alti-r).

> Free Space Optical (FSO) communication technology allows to improve connectivity and bandwidth in urban scenarios through wireless fiber-like point-to-point links. These links, however, are subject to strict line-of-sight (LoS) requirements, and their capacity (throughput) is sensitive to and strongly depends on various atmospheric phenomena. These constraints limit their range.
> This work examines the topological characteristics of the (supplementary) connectivity graph that can be obtained by implementing FSO on existing cell sites (i.e., without new additional cell sites), taking into account existing topographic obstructions and FSO technical constraints and features (e.g., link reconfiguration). In particular, the paper examines the distribution of distance in FSO LoS-compliant links between existing cell sites.
> The study relies on public data and FSO link and obstruction empirical models.
> Results are presented for Paris and three other French urban regions (Lyon, Bordeaux, Toulouse), but the described methodology (based on open-source code) can be applied in other territories as well.
> Preliminary obtained results indicate that exploitation of existing cell sites and deployment of FSO technologies in urban areas lead to highly connected FSO meshes with high fault tolerance to failures and obstacles, and thus have the potential to substantially complement existing communication capacities, as well as to improve robustness of existing communication infrastructures.
