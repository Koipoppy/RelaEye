// ═══════════════════════════════════════════════════════════════
//  STAR CATALOG — Real positions in light-years from Sol
// ═══════════════════════════════════════════════════════════════
export const STAR_CATALOG = [
  {name:'Sol',            p:[ 0.000,  0.000,  0.000], spec:'G2V', m:1.00,  r:1.00,  T:5778,  age:4.6,  planets:'REAL'},
  {name:'Alpha Centauri', p:[-1.644, -3.964,  0.371], spec:'G2V', m:1.10,  r:1.22,  T:5790,  age:5.3,  planets:'PROCEDURAL'},
  {name:"Barnard's Star", p:[-0.020,  5.935,  0.250], spec:'M4V', m:0.144, r:0.196, T:3134,  age:10.0, planets:'PROCEDURAL'},
  {name:'Sirius',         p:[-1.613,  8.334, -1.158], spec:'A1V', m:2.06,  r:1.71,  T:9940,  age:0.24, planets:'PROCEDURAL'},
  {name:'Epsilon Eridani',p:[ 6.244, -8.343, -0.873], spec:'K2V', m:0.82,  r:0.735, T:5084,  age:0.6,  planets:'PROCEDURAL'},
  {name:'Tau Ceti',       p:[ 7.883, -8.960,  0.450], spec:'G8V', m:0.78,  r:0.793, T:5344,  age:5.8,  planets:'PROCEDURAL'},
  {name:'61 Cygni',       p:[ 9.246, -6.724,  0.755], spec:'K5V', m:0.70,  r:0.665, T:4526,  age:6.0,  planets:'PROCEDURAL'},
  {name:'Procyon',        p:[-4.790, 10.453, -1.027], spec:'F5V', m:1.50,  r:2.05,  T:6530,  age:1.87, planets:'PROCEDURAL'},
  {name:'Vega',           p:[ 9.193, 22.690,  4.530], spec:'A0V', m:2.14,  r:2.36,  T:9602,  age:0.46, planets:'PROCEDURAL'},
  {name:'TRAPPIST-1',     p:[36.200, 17.500, -5.900], spec:'M8V', m:0.089, r:0.121, T:2566,  age:7.6,  planets:'REAL'},
  {name:'Betelgeuse',     p:[260.0, -470.0, -100.0],  spec:'M2I', m:16.5,  r:764.0, T:3500,  age:0.008,planets:'NONE'},
  {name:'Polaris',        p:[130.0,  400.0,  30.0],   spec:'F7I', m:5.4,   r:37.5,  T:6015,  age:0.07, planets:'NONE'},
  {name:'Rigel',          p:[-230.0,-610.0, -150.0],  spec:'B8I', m:21.0,  r:78.9,  T:12100, age:0.008,planets:'NONE'},
];

// ═══════════════════════════════════════════════════════════════
//  SOLAR SYSTEM — Real data (orbits in AU, sizes in Earth radii)
// ═══════════════════════════════════════════════════════════════
export const SOLAR_PLANETS = [
  {name:'Mercury',  a:0.387,  e:0.206, r:0.383,  color:'#b0a090', type:'rocky',  moon:0},
  {name:'Venus',    a:0.723,  e:0.007, r:0.949,  color:'#e8d5a0', type:'rocky',  moon:0},
  {name:'Earth',    a:1.000,  e:0.017, r:1.000,  color:'#4488cc', type:'rocky',  moon:1},
  {name:'Mars',     a:1.524,  e:0.093, r:0.532,  color:'#cc6644', type:'rocky',  moon:2},
  {name:'Jupiter',  a:5.203,  e:0.048, r:11.21,  color:'#d4c8a8', type:'gas',    moon:95},
  {name:'Saturn',   a:9.537,  e:0.054, r:9.45,   color:'#e8d5a0', type:'gas',    moon:146, ring:true},
  {name:'Uranus',   a:19.19,  e:0.047, r:4.01,   color:'#88ccdd', type:'ice',    moon:27},
  {name:'Neptune',  a:30.07,  e:0.009, r:3.88,   color:'#4466dd', type:'ice',    moon:16},
  {name:'Pluto',    a:39.48,  e:0.249, r:0.186,  color:'#ccbbaa', type:'dwarf',  moon:5},
];

// ═══════════════════════════════════════════════════════════════
//  TRAPPIST-1 EXOPLANETS — Real data
// ═══════════════════════════════════════════════════════════════
export const TRAPPIST1_PLANETS = [
  {name:'TRAPPIST-1b', a:0.0115, e:0.006, r:1.09, color:'#444444', type:'rocky'},
  {name:'TRAPPIST-1c', a:0.0158, e:0.007, r:1.06, color:'#554444', type:'rocky'},
  {name:'TRAPPIST-1d', a:0.0223, e:0.008, r:0.77, color:'#665544', type:'rocky'},
  {name:'TRAPPIST-1e', a:0.0293, e:0.005, r:0.92, color:'#4488cc', type:'rocky', habitable:true},
  {name:'TRAPPIST-1f', a:0.0385, e:0.010, r:1.04, color:'#5599bb', type:'rocky', habitable:true},
  {name:'TRAPPIST-1g', a:0.0469, e:0.002, r:1.13, color:'#66aacc', type:'rocky', habitable:true},
  {name:'TRAPPIST-1h', a:0.0619, e:0.009, r:0.76, color:'#776655', type:'rocky'},
];
