use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

declare_id!("6S17n5mx37WyuqZnVBh46ACBPdQSnxPfU4CS546LQUvg");

#[program]
pub mod token_extension_anchor {
    use anchor_lang::system_program::{create_account, CreateAccount};
    use spl_tlv_account_resolution::{account::ExtraAccountMeta, state::ExtraAccountMetaList};
    use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};

    use super::*;

    pub fn intialize_extra_account_meta_list(
        ctx: Context<InitializeExtraMetadataList>,
    ) -> Result<()> {
        let account_metas: Vec<ExtraAccountMeta> = vec![];

        let account_size = ExtraAccountMetaList::size_of(account_metas.len()).unwrap() as u64;
        let lamports = Rent::get()?.minimum_balance(account_size as usize);
        let mint = ctx.accounts.mint.key();
        let signer_seed: &[&[&[u8]]] = &[&[
            b"extra-account-metas",
            mint.as_ref(),
            &[ctx.bumps.extra_account_meta_list],
        ]];

        // create ExtraAccountMetaList account
        create_account(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                CreateAccount {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.extra_account_meta_list.to_account_info(),
                },
                signer_seed,
            ),
            lamports,
            account_size,
            ctx.program_id,
        )?;

        ExtraAccountMetaList::init::<ExecuteInstruction>(
            &mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,
            &account_metas,
        )?;
        Ok(())
    }

    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        msg!("Hook called with amount: {}", amount);
        Ok(())
    }

    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        let instruction = TransferHookInstruction::unpack(data)?;

        match instruction {
            TransferHookInstruction::Execute { amount } => {
                let amount_bytes = amount.to_le_bytes();

                __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
            }
            _ => return Err(ProgramError::InvalidInstructionData.into()),
        }
    }
}

#[derive(Accounts)]
pub struct InitializeExtraMetadataList<'info> {
    #[account(mut)]
    payer: Signer<'info>,

    /// CHECK: ExtraAccountMetaList Account, must use these seeds
    #[account(mut,
    seeds = [b"extra-account-metas", mint.key().as_ref()],
    bump
    )]
    pub extra_account_meta_list: AccountInfo<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associate_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// Order of accounts matters for this struct.
// The first 4 accounts are the accounts required for token transfer (source, mint, destination, owner)
// Remaining accounts are the extra accounts required from the ExtraAccountMetaList account
// These accounts are provided via CPI to this program from the token2022 program
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
    /// CHECK: source token account owner, can be SystemAccount or PDA owned by another program
    pub owner: UncheckedAccount<'info>,
    /// CHECK: ExtraAccountMetaList Account, pda
    #[account(
        seeds = [b"extra-account-metas", mint.key().as_ref()], 
        bump
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,
}
