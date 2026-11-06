window.PHRASES = {
  langs: [
    { id: 'en', name: 'English' }, { id: 'af', name: 'Afrikaans' }, { id: 'zu', name: 'isiZulu' },
    { id: 'xh', name: 'isiXhosa' }, { id: 'st', name: 'Sesotho' }, { id: 'tn', name: 'Setswana' }
  ],
  rows: []
};
(function () {
  const R = (g, en, af, zu, xh, st, tn) => window.PHRASES.rows.push({ g, en, af, zu, xh, st, tn });
  R('Greetings', 'Hello', 'Hallo', 'Sawubona', 'Molo', 'Dumela', 'Dumela');
  R('Greetings', 'How are you?', 'Hoe gaan dit?', 'Unjani?', 'Unjani?', 'O phela joang?', 'O tsogile jang?');
  R('Greetings', 'Thank you', 'Dankie', 'Ngiyabonga', 'Enkosi', 'Kea leboha', 'Ke a leboga');
  R('Greetings', 'Please', 'Asseblief', 'Ngiyacela', 'Nceda', 'Ka kopo', 'Tsweetswee');
  R('Greetings', 'Yes', 'Ja', 'Yebo', 'Ewe', 'Ee', 'Ee');
  R('Greetings', 'No', 'Nee', 'Cha', 'Hayi', 'Che', 'Nnyaa');
  R('Greetings', 'Sorry', 'Jammer', 'Ngiyaxolisa', 'Uxolo', 'Ntshwarele', 'Intshwarele');
  R('Emergency', 'Help!', 'Help!', 'Siza!', 'Ndincedeni!', 'Thusa!', 'Thusa!');
  R('Emergency', 'I need help', 'Ek het hulp nodig', 'Ngidinga usizo', 'Ndifuna uncedo', 'Ke hloka thuso', 'Ke tlhoka thuso');
  R('Emergency', 'Danger', 'Gevaar', 'Ingozi', 'Ingozi', 'Kotsi', 'Kotsi');
  R('Emergency', 'Fire', 'Vuur', 'Umlilo', 'Umlilo', 'Mollo', 'Molelo');
  R('Emergency', 'Stop', 'Stop', 'Ima', 'Yima', 'Ema', 'Eme');
  R('Emergency', 'Run', 'Hardloop', 'Baleka', 'Baleka', 'Matha', 'Taboga');
  R('Emergency', 'I am hurt', 'Ek is seergekry', 'Ngilimele', 'Ndonzakele', 'Ke lemetse', 'Ke gobetse');
  R('Emergency', 'Call a doctor', 'Bel \'n dokter', 'Biza udokotela', 'Biza ugqirha', 'Bitsa ngaka', 'Bitsa ngaka');
  R('Needs', 'Water', 'Water', 'Amanzi', 'Amanzi', 'Metsi', 'Metsi');
  R('Needs', 'Food', 'Kos', 'Ukudla', 'Ukutya', 'Lijo', 'Dijo');
  R('Needs', 'I am thirsty', 'Ek is dors', 'Ngomile', 'Ndinxaniwe', 'Ke nyoriwe', 'Ke nyorilwe');
  R('Needs', 'I am hungry', 'Ek is honger', 'Ngilambile', 'Ndilambile', 'Ke lapile', '');
  R('Needs', 'I am sick', 'Ek is siek', 'Ngiyagula', 'Ndiyagula', 'Ke kula', 'Ke a lwala');
  R('Needs', 'Medicine', 'Medisyne', 'Umuthi', 'Amayeza', 'Moriana', 'Molemo');
  R('Needs', 'Toilet', 'Toilet', 'Ithoyilethi', 'Indlu yangasese', '', '');
  R('Questions', 'Where is...?', 'Waar is...?', 'Ikuphi...?', 'Iphi...?', 'Ke kae...?', 'Go kae...?');
  R('Questions', 'Is it safe?', 'Is dit veilig?', 'Ingabe ivikelekile?', 'Ukhuselekile?', '', '');
  R('Questions', 'Do you have water?', 'Het jy water?', 'Unamanzi?', 'Unamanzi?', 'Na u na le metsi?', 'A o na le metsi?');
  R('Questions', 'I do not understand', 'Ek verstaan nie', 'Angiqondi', 'Andiqondi', 'Ha ke utloisise', 'Ga ke tlhaloganye');
  R('Questions', 'Please speak slowly', 'Praat asseblief stadig', 'Ngicela ukhulume kancane', 'Nceda uthethe kancinci', 'Ka kopo bua butle', '');
  R('Directions', 'Left', 'Links', 'Kwesokunxele', 'Ekhohlo', 'Letšehali', '');
  R('Directions', 'Right', 'Regs', 'Kwesokudla', 'Ekunene', 'Letona', '');
  R('Directions', 'Straight', 'Reguit', 'Qonda', 'Ngqo', '', '');
  R('Directions', 'Close', 'Naby', 'Eduze', 'Kufuphi', 'Haufi', 'Gaufi');
  R('Directions', 'Far', 'Ver', 'Kude', 'Kude', 'Hole', 'Kgakala');
})();
