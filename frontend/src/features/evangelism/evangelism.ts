export type EvangelismStatus='new'|'contacted'|'connected'|'converted_to_member';
export type EvangelismSource='sunday_service'|'cell_outreach'|'personal_evangelism'|'event'|'referral'|'other';
export interface EvangelismContact { id:string; firstName:string; lastName:string; mobile:string; normalizedMobile:string; addressArea:string; dateReached:string; reachedBy:string; reachedByMemberId:string; reachedByMemberName:string; source:EvangelismSource; sourceOther:string; status:EvangelismStatus; notes:string; memberId:string|null; createdAt:string; updatedAt:string; }
export type EvangelismInput=Omit<EvangelismContact,'id'|'normalizedMobile'|'memberId'|'reachedByMemberName'|'createdAt'|'updatedAt'>;
export const STATUS_LABELS:Record<EvangelismStatus,string>={new:'New',contacted:'Contacted',connected:'Connected',converted_to_member:'Converted to Member'};
export const SOURCE_LABELS:Record<EvangelismSource,string>={sunday_service:'Sunday Service',cell_outreach:'Cell Outreach',personal_evangelism:'Personal Evangelism',event:'Event',referral:'Referral',other:'Other'};
export const blankEvangelismContact=():EvangelismInput=>({firstName:'',lastName:'',mobile:'',addressArea:'',dateReached:new Date().toLocaleDateString('en-CA'),reachedBy:'',reachedByMemberId:'',source:'personal_evangelism',sourceOther:'',status:'new',notes:''});
