export interface SiteConfig {
  id: string;
  name: string;
  address: string;
  city: string;
  nit: string;
  phones: string;
  appScriptUrl: string;
  spreadsheetId: string;
  sheetName: string;
}

export const SITES: SiteConfig[] = [
  {
    id: 'ebejico',
    name: 'Ebéjico',
    address: 'Parque Principal EBÉJICO',
    city: 'EBÉJICO / SEVILLA',
    nit: '66709954',
    phones: '312 799 83 41 - 304 209 29 53',
    appScriptUrl: 'https://script.google.com/macros/s/AKfycbw4aYpLDWzq__o30KLhRy7Jkd9XGZV9HX1IQfsjxu0CZ-b1r-pILud72mVboS8KRf4/exec',
    spreadsheetId: '1MULokQ8jhbjK1Fi1HpWv7YQOh-9yuGpoifHRVvAenu0',
    sheetName: 'mensualidades 2026'
  },
  {
    id: 'heliconia',
    name: 'Heliconia',
    address: 'Parque Principal HELICONIA',
    city: 'HELICONIA',
    nit: '71778450',
    phones: '312 799 83 41 - 304 209 29 53',
    appScriptUrl: 'https://script.google.com/macros/s/AKfycbzug7FuyBFty_ODIH3oprm4Pl32yurgJBxZ0ykZCwbk5JAtWm18cmDw-QtFOn4v_fQY/exec',
    spreadsheetId: '1LclqwFBtLqIW2KOq5pWXYY2EIqR95R6IxIjQJLt4X-k',
    sheetName: '2026'
  }
];
