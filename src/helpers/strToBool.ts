export default (str: string) => {
  if (str === 'true') {
    return true;
  } else  if (str === 'false') {
    return false;
  }
  console.log('strToBool returning false on non "true"/"false" string:', str);
  return false;
}