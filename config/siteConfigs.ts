export interface SiteConfig {
  id: string;
  name: string;
  orgName: string;
  address: string;
  city: string;
  nit: string;
  phones: string;
}

export const SITES: SiteConfig[] = [
  {
    id: 'ebejico',
    name: 'Ebéjico',
    orgName: 'LA FE SERVICIOS FUNERARIOS',
    address: 'EBÉJICO',
    city: 'EBÉJICO',
    nit: '66709954',
    phones: '312 799 83 41'
  },
  {
    id: 'heliconia',
    name: 'Heliconia',
    orgName: 'ORGANIZACIÓN SERVICIOS FUNERARIOS',
    address: 'HELICONIA',
    city: 'HELICONIA',
    nit: '71778450',
    phones: '311 737 60 28'
  },
  {
    id: 'sevilla',
    name: 'Sevilla',
    orgName: 'LA FE SERVICIOS FUNERARIOS',
    address: 'SEVILLA',
    city: 'SEVILLA',
    nit: '66709954',
    phones: '312 799 83 41'
  }
];
