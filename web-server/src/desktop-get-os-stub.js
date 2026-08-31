const falseValue = () => false

module.exports = {
  getOS: () => 'Mac OS',
  isMacOSBigSurOrLater: falseValue,
  isMacOSTahoeOrLater: () => true,
  isMacOSMojaveOrLater: () => true,
  isMacOSSonoma: falseValue,
  isMacOSSonomaOrLater: () => true,
  isMacOSVentura: falseValue,
  isMacOSSequoia: falseValue,
  isMacOSCatalinaOrEarlier: falseValue,
  isWindows10And1809Preview17666OrLater: falseValue,
  isWindowsAndNoLongerSupportedByElectron: falseValue,
  isMacOSAndNoLongerSupportedByElectron: falseValue,
  isOSNoLongerSupportedByElectron: falseValue,
}
