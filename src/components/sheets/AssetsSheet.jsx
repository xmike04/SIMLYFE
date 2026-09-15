import React, { useState } from 'react';
import ActionSheet from '../ActionSheet';
import { getWealthTier, calculateIncomeTax } from '../../config/wealthTiers';
import AssetOverview from './assets/AssetOverview';
import AssetFinances from './assets/AssetFinances';
import AssetPortfolio from './assets/AssetPortfolio';
import AssetShopping from './assets/AssetShopping';

export default function AssetsSheet({
  bank, properties, belongings, career, economyCycle,
  buyAsset, sellAsset, buyInvestment, sellInvestment,
  modifyProperty, triggerActivityEvent, debugModifyBank,
  onClose,
}) {
  // Keep navigation here so returning from the overview preserves the shopping tab.
  // Closing the sheet still unmounts this entire state boundary.
  const [assetMenu, setAssetMenu] = useState(null);
  const [selectedProp, setSelectedProp] = useState(null);
  const [shopTab, setShopTab] = useState('realEstate');
  const [shopStore, setShopStore] = useState(null);
  const [investSubType, setInvestSubType] = useState(null);
  const [investSelected, setInvestSelected] = useState(null);
  const [investAmount, setInvestAmount] = useState('');

  const close = () => {
    setAssetMenu(null);
    setSelectedProp(null);
    setShopStore(null);
    setInvestSubType(null);
    setInvestSelected(null);
    setInvestAmount('');
    onClose();
  };

  const tier = getWealthTier(bank);
  const propVal = properties.reduce((acc, p) => acc + p.currentValue, 0);
  const belVal  = belongings.reduce((acc, b) => acc + b.currentValue, 0);
  const equity  = career?.equity ?? 0;
  const netWorth = Math.floor(bank + propVal + belVal + equity);
  const annualSalary = career?.salary ?? 0;
  const annualIncomeTax = calculateIncomeTax(annualSalary, bank);
  const annualUpkeep = properties.reduce((a, p) => a + (p.upkeep || 0), 0) + belongings.reduce((a, b) => a + (b.upkeep || 0), 0);
  const cashflow = annualSalary - annualIncomeTax - annualUpkeep - tier.lifestyleCost;

  return (
    <ActionSheet
      title={assetMenu ? ({ finances: '📈 Finances', properties: '🏡 Properties', belongings: '💎 Belongings', shopping: '🛍️ Shop' }[assetMenu] || 'Assets') : '🏦 Assets'}
      onClose={() => { setAssetMenu(null); setSelectedProp(null); onClose(); }}
    >
      {!assetMenu && <AssetOverview
        bank={bank}
        properties={properties}
        belongings={belongings}
        tier={tier}
        netWorth={netWorth}
        propVal={propVal}
        belVal={belVal}
        equity={equity}
        setAssetMenu={setAssetMenu}
      />}
      {assetMenu === 'finances' && <AssetFinances
        tier={tier}
        netWorth={netWorth}
        annualSalary={annualSalary}
        annualIncomeTax={annualIncomeTax}
        annualUpkeep={annualUpkeep}
        cashflow={cashflow}
        setAssetMenu={setAssetMenu}
      />}
      {assetMenu === 'portfolio' && <AssetPortfolio
        bank={bank}
        properties={properties}
        belongings={belongings}
        tier={tier}
        selectedProp={selectedProp}
        setSelectedProp={setSelectedProp}
        setAssetMenu={setAssetMenu}
        sellAsset={sellAsset}
        debugModifyBank={debugModifyBank}
        modifyProperty={modifyProperty}
        triggerActivityEvent={triggerActivityEvent}
        close={close}
      />}
      {assetMenu === 'shopping' && <AssetShopping
        bank={bank}
        properties={properties}
        belongings={belongings}
        tier={tier}
        economyCycle={economyCycle}
        shopTab={shopTab}
        setShopTab={setShopTab}
        shopStore={shopStore}
        setShopStore={setShopStore}
        investSubType={investSubType}
        setInvestSubType={setInvestSubType}
        investSelected={investSelected}
        setInvestSelected={setInvestSelected}
        investAmount={investAmount}
        setInvestAmount={setInvestAmount}
        buyAsset={buyAsset}
        buyInvestment={buyInvestment}
        sellInvestment={sellInvestment}
        triggerActivityEvent={triggerActivityEvent}
        setAssetMenu={setAssetMenu}
      />}
    </ActionSheet>
  );
}
