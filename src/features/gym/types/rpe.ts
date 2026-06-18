export interface RpeOption {
  value: number;
  label: string;
  detail: string;
  feel: string;
}

export const RPE_OPTIONS: RpeOption[] = [
  { value: 10, label: 'RPE 10', detail: 'No reps left',  feel: 'Absolute max. Couldn\'t do another rep with any weight.' },
  { value: 9,  label: 'RPE 9',  detail: '1 rep left',    feel: 'Near maximal. One more possible but form would break.' },
  { value: 8,  label: 'RPE 8',  detail: '2 reps left',   feel: 'Very hard. Two more possible, form still solid.' },
  { value: 7,  label: 'RPE 7',  detail: '3 reps left',   feel: 'Hard. Challenging but sustainable, clear reps left.' },
  { value: 6,  label: 'RPE 6',  detail: '4 reps left',   feel: 'Moderate-hard. Noticeable effort, plenty in reserve.' },
  { value: 5,  label: 'RPE 5',  detail: '5+ reps left',  feel: 'Moderate. Comfortable working weight, easy to continue.' },
  { value: 4,  label: 'RPE 4',  detail: 'Easy',          feel: 'Light effort. Warmup or technique work territory.' },
  { value: 3,  label: 'RPE 3',  detail: 'Very easy',     feel: 'Minimal fatigue. Could do many more sets.' },
  { value: 2,  label: 'RPE 2',  detail: 'Very light',    feel: 'Barely any effort. Just moving the bar.' },
  { value: 1,  label: 'RPE 1',  detail: 'Trivial',       feel: 'No exertion. Pure movement pattern practice.' },
];
