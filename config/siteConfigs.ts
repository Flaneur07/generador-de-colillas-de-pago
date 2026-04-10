export interface SiteConfig {
  id: string;
  name: string;
  orgName: string;
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
    orgName: 'ORGANIZACIÓN SERVICIOS FUNERARIOS',
    address: 'Parque Principal EBÉJICO',
    city: 'EBÉJICO',
    nit: '66709954',
    phones: '312 799 83 41 - 304 209 29 53',
    appScriptUrl: 'https://script.google.com/macros/s/AKfycbw4aYpLDWzq__o30KLhRy7Jkd9XGZV9HX1IQfsjxu0CZ-b1r-pILud72mVboS8KRf4/exec',
    spreadsheetId: '1MULokQ8jhbjK1Fi1HpWv7YQOh-9yuGpoifHRVvAenu0',
    sheetName: 'mensualidades 2026'
  },
  {
    id: 'heliconia',
    name: 'Heliconia',
    orgName: 'ORGANIZACIÓN LA FE',
    address: 'Parque Principal HELICONIA',
    city: 'HELICONIA',
    nit: '71778450',
    phones: '312 799 83 41 - 304 209 29 53',
    appScriptUrl: 'https://script.google.com/macros/s/AKfycbzug7FuyBFty_ODIH3oprm4Pl32yurgJBxZ0ykZCwbk5JAtWm18cmDw-QtFOn4v_fQY/exec',
    spreadsheetId: '1LclqwFBtLqIW2KOq5pWXYY2EIqR95R6IxIjQJLt4X-k',
    sheetName: '2026'
  },
  {
    id: 'sevilla',
    name: 'Sevilla',
    orgName: 'ORGANIZACIÓN SERVICIOS FUNERARIOS',
    address: 'Parque Principal SEVILLA',
    city: 'SEVILLA',
    nit: '66709954',
    phones: '312 799 83 41 - 304 209 29 53',
    appScriptUrl: 'https://script.google.com/macros/s/AKfycbwD-0vS8zZFT9h3CzSGHCilTW4eODyb_3r78uFjqZecdt0m0A7i-HZqUAm1HG0fHaA3/exec',
    spreadsheetId: '1OFb8M6XawHArv8KyyxaeYUfpj1gS5vakdvCVrtgY2e8',
    sheetName: 'Planilla Pagos'
  }
];
