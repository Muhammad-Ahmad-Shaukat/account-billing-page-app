export function addressLines(value) {
  if (!value) return ['-'];
  if (typeof value !== 'object') return [String(value)];
  const first=(...keys)=>keys.map(key=>value[key]).find(Boolean);
  const locality=[first('city'),first('province','state'),first('postal','postal_code','zip')].filter(Boolean).join(', ');
  const known=new Set(['name','company','company_name','address1','address2','street_address1','street_address2','city','province','state','postal','postal_code','zip','country','phone']);
  const lines=[value.name,first('company','company_name'),first('address1','street_address1'),first('address2','street_address2'),locality,value.country,value.phone,
    ...Object.keys(value).filter(key=>!known.has(key) && typeof value[key]!=='object').map(key=>value[key])];
  return [...new Set(lines.filter(Boolean).map(String))];
}
