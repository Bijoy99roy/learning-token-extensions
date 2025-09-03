use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token_interface::{Mint, TokenAccount, TokenInterface}};
use spl_tlv_account_resolution::{account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList};
declare_id!("3pT5VXKgQy1AFvoMsUYwhYUvZa8kFXyhiJWSTAB9RB5V");

#[program]
pub mod detect_whale_transfer_hook {
    

    use anchor_lang::system_program::{CreateAccount, create_account};
    use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};

    use super::*;

    pub fn initialize_extra_account(ctx: Context<InitializeExtraAccountMeta>) -> Result<()> {
        
        // Add the whale account pda as extra account

        let account_metas = vec![
            ExtraAccountMeta::new_with_seeds(
                &[
                    Seed::Literal{
                        bytes: "whale_account".as_bytes().to_vec()
                    }
                ],
                false, // is_signer
                true   // is_writable
            )?
        ];

        let account_size = ExtraAccountMetaList::size_of(account_metas.len())? as u64;
        let lamports = Rent::get()?.minimum_balance(account_size as usize);

        let mint =ctx.accounts.mint.key();

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"extra-account-metas",
            &mint.as_ref(),
            &[ctx.bumps.extra_account_meta_list],
        ]];

        // Create the ExtraAccountMetaList Account

        create_account(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(), 
                CreateAccount{
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.extra_account_meta_list.to_account_info()
                }, signer_seeds),
                lamports,
                account_size,
                ctx.program_id
        )?;
        // Initialize the ExtraAccountMetaList account with the extra accounts
        ExtraAccountMetaList::init::<ExecuteInstruction>(
            &mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,
            &account_metas,
        )?;
        Ok(())
    }

    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        

        if amount >= 1000 * (u64::pow(10, ctx.accounts.mint.decimals as u32)) {
            msg!("Whale with amount: {}", amount);
            ctx.accounts.latest_whale_account.whale_address = ctx.accounts.owner.key();
            ctx.accounts.latest_whale_account.transfer_amount = amount;

            emit!(WhaleTransferEvent {
                whale_address: ctx.accounts.owner.key(),
                transfer_amount: amount
            });
        }

        Ok(())
    }

    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8]
    ) -> Result<()>{
        let instruction = TransferHookInstruction::unpack(data)?;

        // match instruction discriminator to transfer hook interface execute instruction
        // token2022 program CPIs this instruction on token transfer
        match instruction{
            TransferHookInstruction::Execute {amount} =>{
                let amount_bytes = amount.to_le_bytes();
                __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
            },
            _=> return Err(ProgramError::InvalidInstructionData.into())
        }
    }

}

#[derive(Accounts)]
pub struct InitializeExtraAccountMeta<'info> {
    #[account[mut]]
    pub payer: Signer<'info>,
    /// CHECK: ExtraAccountMetaList Account, must use these exact seeds
    #[account(mut, seeds=[b"extra-account-metas", mint.key().as_ref()], bump)]
    pub extra_account_meta_list: AccountInfo<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        seeds=[b"whale_account"],
        bump,
        payer = payer,
        space=8+WhaleAccount::INIT_SPACE
    )]
    pub latest_whale_account: Account<'info, WhaleAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferHook<'info> {
    #[account(
        token::mint = mint,
        token::authority = owner
    )]
    pub source_token: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        token::mint = mint
    )]
    pub destination_token: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: source token account owner,
    /// can be SystemAccount or PDA owned by another program
    pub owner: UncheckedAccount<'info>,
    /// CHECK: ExtraAccountMetaList Account,
    #[account(seeds = [b"extra-account-metas", mint.key().as_ref()],bump)]
    pub extra_account_meta_list: UncheckedAccount<'info>,
    #[account(
        mut, 
        seeds=[b"whale_account"],
        bump
    )]
    pub latest_whale_account: Account<'info, WhaleAccount>,
}

#[account]
#[derive(InitSpace)]
pub struct WhaleAccount {
    pub whale_address: Pubkey,
    pub transfer_amount: u64,
}

#[event]
pub struct WhaleTransferEvent {
    pub whale_address: Pubkey,
    pub transfer_amount: u64
}