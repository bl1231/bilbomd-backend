#!/usr/bin/perl 
use Cwd;
use Scalar::Util qw(looks_like_number);
use Sys::Hostname;

# use MIME::Lite;

print " ********************************************************* \n";
print " ****************** BILBOMD version 2.0 ****************** \n";
print " ********************** 6/08/2016 ************************ \n";
print " ********************************************************* \n";
print " ******************** by Michal Hammel ******************* \n";
print " ********************************************************* \n";
print " *** minimal-MD conformational sampling and MULTIFOXS **** \n";
print " ********************************************************* \n";
print " \n";

foreach ( sort keys %ENV ) {
    print "$_  =  $ENV{$_}\n";
}

########################################################
## MAIN PROGRAM BODY ###################################
########################################################

&setup;

&input_for_dynamics_and_foxs;

unless ( -e $dir . '/' . $file . '_min.crd' ) {
    &minimization;
}

unless ( -e $dir . '/' . $file . '_heat.crd' ) {
    &heating;
}

unless ( -e $dir . '/' . $file . $StartNumrg . '_1.dcd' ) {
    &dynamics;
}

&foxs_from_new_dcd;

&multifoxs;

&extracting_pdbs;

&bilbomd_done;

&cleaning;
#######################################################
#######################################################

sub setup {

    ##################change me##################
    $Charmmdir = "/usr/local/bin/charmm";    # CHARMM executable command
    $Toppardir = "topparmichal.str";         # CHARMM tompology  files
    $multifoxs = "/usr/bin/multi_foxs ";     #multifoxs
    $foxs      = "/usr/bin/foxs ";           # foxs
    $claros    = "claros";                   #hostname
    $const     = "const.inp";                # need constrain file
    #############################################
    #
    # get total arg passed to this script
    my $total   = $#ARGV + 1;
    my $counter = 0;
    #
    # get script name
    my $scriptname = $0;
    #
    print "Total args passed to $scriptname : $total\n";
    #
    # Use loop to print all args stored in an array called @ARGV
    foreach my $a (@ARGV) {
        print "Arg # $counter : $a\n";
        $counter++;
    }
    if ( $total != 6 ) {
        print "\n";
        print "\n";
        print "USAGE : \n";
        print "\n";
        print " BILBOMD2 psf dat #runs #Rg_min #Rg_max  email \n ";
        print "\n";
        print "\n";
        print "psf is the CHARMM.psf parameter file, \n";
        print "file.crd need to be in working dir.(use .psf extension.) \n ";
        print "file.dat  is SAXS experimental data \n ";
        print "#runs \n";
        print "####################################\n";
        print "1 = 200 conformations per Rg\n";
        print "2 = 400 conformations per Rg\n";
        print "3 = 600 conformations per Rg\n";
        print "4 = 800 conformations per Rg\n";
        print "####################################\n";
        print "Rg min  need to be in the range 10 - 100 \n";
        print "Rg max  need to be in the range 10 - 100 \n";
        print "####################################\n";
        print " valid email adress\n";

        &cleaning;
    }

    ##################checking  DIR, PSF  CRD  and  hostname ###################

    my $bilbopwd = cwd();

    #$dir = $bilbopwd . "/" . $ARGV[1];
    $dir = $bilbopwd;
    $dir =~ s/\/$//;
    print "\n BILBOMD  working dir = $dir\n";

    # check for and remove trailing slash from $dir
    $cmd1 = "mkdir -p $dir/fit/";
    system $cmd1;
    $email    = $ARGV[5];
    $hostname = hostname;
    if ( $hostname !~ /$claros/ ) {
        print "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n";
        print " Please LOG IN TO THE CALROS and start aggain  {ssh claros}\n";
        print "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n";
        &cleaning;
    }

    print "Done. \n";
    print "</code> \n";

    print " <code class=\"gold\"> \n";
    print " ********************************************************* \n";
    print " ********************* clean_segments ******************** \n";
    print " ********************************************************* \n";
    print " ********************************************************* \n";
    print " \n";

    # Enter PSF file

    $psf = $ARGV[0];
    chomp($psf);
    unless ( -e $dir . '/' . $psf ) {
        print "!!!!!!! PSF file $psf do not exist, start  aggain !!!!!!!\n ";
        &cleaning;
    }
    $num1       = length($psf);
    $rootlength = $num1 - 4;
    $file       = substr( $psf, 0, $rootlength );
    chomp($file);

    #$file =~ tr/[A-Z]/[a-z]/;
    print "File rootname will be  = $file \n";
    $crd = $file . '.crd';
    unless ( -e $dir . '/' . $crd ) {
        print "!!!!!!! CRD file $crd not exist, start  aggain !!!!!!!\n ";
        &cleaning;
    }

    $file =~ tr/[A-Z]/[a-z]/;
    $cmd = "cp -f  $psf $file.psf ";
    system $cmd;
    $cmd = "cp -f  $crd $file.crd ";
    system $cmd;
    $file_heat = $file . '_heat';
    $file_min  = $file . '_min';

    print "Done. \n";
    print "</code> \n";
}

############################## input for DYNAMICS  and FOXS set up making define.inp ########################################
sub input_for_dynamics_and_foxs {
    print " <code class=\"gold\"> \n";
    print " ********************************************************* \n";
    print " ************* input_for_dynamics_and_fox **************** \n";
    print " ********************************************************* \n";
    print " ********************************************************* \n";
    print " \n";

    #Experimental DAT file
    $dat_dirty = $ARGV[1];
    chomp($dat_dirty);
    unless ( -e $dir . '/' . $dat_dirty ) {
        print "Experimental DATA $dat_dirty do not exist, start again!\n ";
        &cleaning;
    }
    print " Experimental data = $dat_dirty \n";
    $num1       = length($dat_dirty);
    $rootlength = $num1 - 4;
    $rootdat    = substr( $dat_dirty, 0, $rootlength );
    $dat        = $rootdat . '.dat';
    $dat_backup = $rootdat . '_backup.dat';
    $cmd        = "mv  $dir/$dat_dirty  $dir/$dat_backup";
    system $cmd;
    open( INFILE,  "$dir/$dat_backup" ) or die $!;
    open( OUTFILE, "> $dir/$dat" )      or die $!;

    # Print a empty line at the begining of the file
    print OUTFILE "\n";
    while (<INFILE>) {
        chomp;

    #Only match a line that begins with a whitespace (optional) and then numbers
        if ( $_ =~ m/^\d+/ || $_ =~ m/^\s+\d+/ ) {
            print OUTFILE "$_\n";
        }
    }
    close(INFILE);
    close(OUTFILE);

    $startrun = 1;

    # Conformational Sampling ########################
    #print " Conformational sampling: short- 1 ; medium- 2 ; long- 3 or -4 ?\n";
    print " \n";
    print "####################################\n";
    print "1 = some = 200 conformations per Rg\n";
    print "2 = more = 400 conformations per Rg\n";
    print "3 = many = 600 conformations per Rg\n";
    print "4 = wow = 800 conformations per Rg\n";
    print "####################################\n";
    $run = $ARGV[2];

    unless ( $run !~ /\D/ && $run =~ /^[1-4]/ && $run < 5 ) {
        print " The lengths of run can be only 1 to 4, start aggain\n ";
        &cleaning;
    }
    print "Conformational Sampling =  $run \n";

    # Rg min #########################################
    $StartNumrg = $ARGV[3];

    if ($StartNumrg) {
        unless ( $StartNumrg !~ /\D/
            && $StartNumrg =~ /^[1-9]/
            && $StartNumrg < 100 )
        {
            print "Rg min  need to be in the range 10 - 100 \n";
            &cleaning;
        }
    }
    print " Rg min = $StartNumrg \n";

    # Rg max #########################################
    $EndNumrg = $ARGV[4];

    if ($EndNumrg) {
        unless ( $EndNumrg !~ /\D/ && $EndNumrg =~ /^[1-9]/ && $EndNumrg < 200 )
        {
            print "Rg max  need to be in the range 10 - 100 \n";
            &cleaning;
        }
    }
    print " Rg max = $EndNumrg \n";
    if ( $EndNumrg < $StartNumrg ) {
        $tmp        = $StartNumrg;
        $StartNumrg = $EndNumrg;
        $EndNumrg   = $tmp;
    }

    # maximal Rg steps 5 ############################
    $steps  = 5;
    $Rgstep = $EndNumrg - $StartNumrg;
    $Rgstep = $Rgstep / $steps;
    $Rgstep = sprintf( "%0.f", $Rgstep );

    if ( $Rgstep == 0 ) {
        $Rgstep = 1;
    }

    ####increas the MD  steps  to 2 fs is possible  ###
    $step = 0.001;
    ###################some variables  name ####

    $p         = '"';
    $at        = "@";
    $tr        = "tr";
    $rgyr      = "rgyr";
    $under     = "_";
    $underdat  = "_$rootdat.dat";
    $underdatc = '_' . $rootdat . 'c.dat';
    $pdbdat    = ".pdb.dat";

    print "Done. \n";
    print "</code> \n";

}

################################# starting minimized  #####################################
sub minimization {
    print " <code class=\"gold\"> \n";
    print " ********************************************************* \n";
    print " ******************** minimization *********************** \n";
    print " ********************************************************* \n";
    print " ********************************************************* \n";
    print " \n";

    open( MINIMIZEINP, "> $dir/minimize.inp" );
    print MINIMIZEINP "* minimize
* Energy minimization
* Michal Hammel
*

		bomlev -2

		! Read Topology-Files
		STREAM $Toppardir
	
		open read  unit 12 card name $psf
		read psf card unit 12
		close unit 12

		open read  unit 12 card name $crd
		read coor card unit 12
		close unit 12

		coor stat
		coor copy comp
		energy atom vatom cutnb 14.0 ctofnb 12. cdie eps 80. -
      		 ctonnb 11. vfswitch switch

		!stream const.inp

		mini sd nstep 500 nprint 50     ! nstep needs to be 500
		mini abnr nstep 500 nprint 50 tolgrd 0.0001  ! 500 needs to be
		coor stat
		coor orie  rms mass sele .not. type H* end
		coor orie  rms mass sele type H* end
		open write card unit 23 name $file_min.crd
		write coor card unit 23
		*
		close unit 23
		open write unit 24 card name $file_min.pdb
		write coor pdb unit 24

		stop
		";

    close(MINIMIZEINP);

    $cmd1 = "$Charmmdir < $dir/minimize.inp > $dir/mimimize.out &";
    system $cmd1;
    print "Starting  minimization \n";
    until ( -e "$dir/$file_min.pdb" ) {
        print " Minimizing $file.pdb \n";
        sleep(20);
    }

    print "\n";

    print "Minimization is complete and $file" . "_min.pdb was written.\n";

    print "Done. \n";
    print "</code> \n";
}

################################# startting heating  #####################################
sub heating {
    print " <code class=\"gold\"> \n";
    print " ********************************************************* \n";
    print " *********************** heating ************************* \n";
    print " ********************************************************* \n";
    print " ********************************************************* \n";
    print " \n";

    open( HEATINP, "> $dir/heat.inp" );
    print HEATINP "* heat
* linker heat 
* Michal Hammel
*

		bomlev -2

		! Read Topology-Files
		STREAM $Toppardir
	
		open read  unit 12 card name $psf
		read psf card unit 12
		close unit 12

		open read  unit 12 card name $file_min.crd
		read coor card unit 12
		close unit 12

		NBONDS    bygr  noelec cdie e14fac 0.0 eps 0.0 vdw  vswitch CUTNB 8.0 -
		inbfrq 100 wmin 1.0

		open write unit 1 card name $file_heat.rst
		STREAM  $const
		dyna verlet start nstep 15000 timestep 0.001 eche 50.0 -
		    iprfrq 500 ihtfrq 100 teminc 10.0  -
  		    nprint 500 iunwri 1 iunrea -1 iuncrd -1  nsavc 0  -
		    firstt 0.0 finalt 1500.0 -
		    iasors 1 iasvel 1 iscvel 0 ichecw 0

		open write unit 1 card name $file_heat.crd
		write coor card unit 1

		open write unit 1 card name $file_heat.pdb
		write coor pdb unit 1

		stop
		";

    close(HEATINP);

    $cmd1 = "$Charmmdir  < $dir/heat.inp > $dir/heat.out &";
    system $cmd1;

    until ( -e "$dir/$file_heat.pdb" ) {
        print " Heating  $file" . "_min.pdb \n";
        sleep(20);
    }

    print " \n";
    print "Heating is complete and the $file" . "_heat.pdb was written.\n";

    print "Done. \n";
    print "</code> \n";
}

################################# starting dynamics  #####################################
sub dynamics {
    print " <code class=\"gold\"> \n";
    print " ********************************************************* \n";
    print " ********************** dynamics ************************* \n";
    print " ********************************************************* \n";
    print " ********************************************************* \n";
    print " \n";
    $_ii = '_' . $at . 'ii';
    $ii  = $at . 'ii';
    $i   = '$i';

    $cmd1 = "rm  -f   $dir/*.end ";
    system $cmd1;
    for ( $y = $StartNumrg ; $y <= $EndNumrg ; $y = $y + $Rgstep ) {
        open( DYNAINP, "> $dir/$file.dyna$y.inp" );
        print DYNAINP "*  dynamics by  1500K  with the rigid bodies in blocks
* Michal Hammel
*


			bomlev -4

			! Read Topology-Files
			STREAM $Toppardir
	
			open read  unit 12 card name $psf
			read psf card unit 12
			close unit 12

			open read  unit 12 card name  $file_heat.crd
			read coor card unit 12
			close unit 12

			DEFINE ACTIVE sele type CA  end
			NBACtive SELE ACTIVE  end

			NBONDS    bygr  noelec cdie e14fac 0.000 eps 0.0 vdw  vswitch CUTNB 8.0 -
			inbfrq 100 wmin 1.0
			open read unit 30 card name $file_heat.rst

			STREAM  $const
			RGYRestrain Force 20 Reference $y  select ALL   end
			


			set ii $startrun
			label loop
			open write unit 34  file name $file$y$ii.start
			close unit 34

			open write unit 31 card name $file$y$_ii.rst
			open write unit 32 file name $file$y$_ii.dcd
 
			dyna verlet restart nstep 100000 timestep $step -
			    iprfrq 1000 ihtfrq 0 ieqfrq 100 -
 			    iuncrd 32 iunwri 31 iunrea 30 -
			    nprint 1000 nsavc 500 -
			    firstt 1500.0 finalt 1500.0 tstruc 1500.0 -
			    iasors 0 iasvel 1 iscvel 0 ichecw 1 TWINDH 100.0 TWINDL 500.0 -
			    echeck 1.0E+30

			close unit 31
			close unit 32
			open read unit 30 card name $file$y$_ii.rst
			open write unit 35  file name $file$y$ii.end
			close unit 35
			incr ii by 1
			if ii lt $run.5 goto loop
			stop
			";
        close(DYNAINP);

        $cmd1 = "cd $dir";
        system $cmd1;
        $cmd1 = "$Charmmdir < $dir/$file.dyna$y.inp > $dir/$file.dyna$y.out &";
        system $cmd1;
        print " conformational sampling started for Rg = $y \n";
        sleep(1);
    }

    print "Done. \n";
    print "</code> \n";
}

###################################### FoXS  from new DCD files #####################################
sub foxs_from_new_dcd {
    print " <code class=\"gold\"> \n";
    print " ********************************************************* \n";
    print " ***************** foxs_from_new_dcd ********************* \n";
    print " ********************************************************* \n";
    print " ********************************************************* \n";
    print " \n";

    open( FOXS, ">$dir/$file.foxs_rg.out" )
      || die "Could not open file $file.foxs_rg.out : $!\n";
    print FOXS "file	        Rg 	     Dmax\n";
    close(FOXS);
    $atnframe = "@" . "nframe";
    $atbegin  = "@" . "begin";
    $atstop   = "@" . "stop";
    $atstep   = "@" . "step";

    $countstart = 0;
    $countend   = 0;
    ++$countstart while glob "$dir/$file.dyna*.inp";
    $countstart = $countstart * $run;
    until ( $countend == $countstart ) {
        for ( $r = $startrun ; $r < $run + 1 ; $r++ ) {
            for ( $RG = $StartNumrg ; $RG < $EndNumrg + 1 ; $RG++ ) {
                if (   -e $dir . '/' . $file . $RG . '_' . $r . '.rst'
                    && -e $dir . '/' . $file . $RG . $r . '.end' )
                {
                    $endfile = "$dir/$file$RG$r.end";
                    $cmd     = " rm -f  $endfile ";
                    system $cmd;
                    ++$countend;
                    $dcd  = $dir . '/' . $file . $RG . '_' . $r . '.dcd';
                    $dcd2 = $file . $RG . '_' . $r . '.dcd';
                    $rst  = $dir . '/' . $file . $RG . '_' . $r . '.rst';

                    open( DCD,
                        $dir . '/' . $file . '' . $RG . '_' . $r . '.dcd' )
                      || die "Could not open $dcd  file : $!\n";
                    open( RST,
                        $dir . '/' . $file . '' . $RG . '_' . $r . '.rst' )
                      || die "Could not open $rst  file : $!\n";
                    close(RST);
                    close(DCD);
                    ############## making inp files for inp files for dcd2pdb ############

                    open( DCD2PDB, "> $dir/$file$RG$r.inp" );
                    print DCD2PDB "*DCD2PDB
*PURPOSE:  Convert cor trajectory to pdb format
*AUTHOR:   Michal Hammel
*
						bomlev -2
						! Read Topology-Files
						STREAM $Toppardir
	
						open read  unit 12 card name $psf
						read psf card unit 12
						close unit 12

						open read formatted unit 27 name $file_heat.pdb
						read coor pdb unit 27
						

						set  nframe = 0						
						open unit 50 read unform name $dcd2
						 trajectory query unit 50
						calc nframe  = $atnframe + ?nfile
						calc begin = ?start
						calc step = ?skip
						calc stop = ?start + ?nstep - ?skip

						traj iread 50 nrea 1 begin $atbegin  stop $atstop  skip $atstep
				

				                set tr $atbegin
                                		LABEL ILP
		                                traj read
       			                        write  coor pdb name fit/$file$RG$under$r$under$at$tr.pdb
               			                define heavy sele type CA  end
  		                                coor rgyr
               			                COOR MAXD  SELE heavy  END SELE heavy  END
                		                open write unit 1 card name $file.foxs_rg.out append
                          	        	write title unit 1
                        		        *$file$RG$under$r$under$at$tr ?rgyr ?maxd
      			                        *

   		                                close unit 1 

               					SYSTEM  \" $foxs -p \$PWD/fit/$file$RG$under$r$under$p$at$tr$p.pdb \"
 	       		                       ! SYSTEM  \" rm \$PWD/$file$RG$under$r$under$p$at$tr$p.pdb \"
       		        	               ! SYSTEM  \" rm \$PWD/$file$RG$under$r$under$p$at$tr$p$pdbdat \"
						! SYSTEM  \" rm \$PWD/*.plt \"
	                                        ! SYSTEM  \" \$PWD/chi.pl $file$RG$under$r$under$p$at$tr$p$underdat \" 
       						
      		                  	       
						incr tr by $atstep
                                                if tr .le. $atstop  goto ILP
						open write unit 34  file name $file$RG$r.end2
						close unit 34
                            	  		stop
                              			";
                    close(DCD2PDB);

                    $cmd = "cd $dir; $Charmmdir < $file$RG$r.inp &";
                    system $cmd;
                    print
                      "calculating FOXS  fits for Rg = $RG   ,  run = $r    \n";

                }

            }
        }
        print "FOXS is fitting  $countend dcd files from $countstart \n";
        sleep(30);
    }

    $countend = 0;
    ++$countend while glob "$dir/$file*.end2";
    until ( $countend == $countstart ) {
        sleep(20);
        $countend = 0;
        ++$countend while glob "$dir/$file*.end2";
        print "countend  end2  $countend dcd files from $countstart \n";
    }

    print "Done.\n";
    print "</code> \n";
}

###########################  MULTIFOXS  ###############################################
sub multifoxs {
    print " <code class=\"gold\"> \n";
    print " ********************************************************* \n";
    print " **************** multifoxs **************** \n";
    print " ********************************************************* \n";
    print " ********************************************************* \n";
    print " \n";

    $cmd = " cp -f $dir/$dat $dir/fit/$dat";
    system $cmd;
    $cmd = " ls  $dir/fit/*.pdb.dat > $dir/fit/filelist";
    system $cmd;
    $cmd = "cd $dir/fit/; $multifoxs  $dat filelist ";
    system $cmd;

    print "Done. \n";
    print "</code> \n";
}

################################ extracting PDBS #################################i
sub extracting_pdbs {
    print " <code class=\"gold\"> \n";
    print " ********************************************************* \n";
    print " **************** extracting PDBS  **************** \n";
    print " ********************************************************* \n";
    print " ********************************************************* \n";
    print " \n";

    $dash = '/';
    for ( $i = 0 ; $i < 5 ; $i++ ) {
        if ( -e $dir . '/fit/ensembles_size_' . $i . '.txt' ) {
            open( MESOUT, "< $dir/fit/ensembles_size_$i.txt" );
            $line = <MESOUT>;
            while ($line) {
                my @words = split /$dash/, $line;
                for (@words) {
                    if ( $_ =~ /$file/ ) {
                        @pdbwords = split /\./, $_;
                        $pdb      = "$pdbwords[0].$pdbwords[1]\n";
                        print " selected structures $pdb\n";
                        chomp($pdb);
                        $cmd = "cp $dir/fit/$pdb  $dir/.";
                        system $cmd;
                    }
                }
                $line = <MESOUT>;
            }
        }
    }
    close MESOUT;
    $cmd = "cp $dir/fit/cluster_representatives.txt $dir/.";
    system $cmd;
    $cmd = "cp $dir/fit/multi_state_model* $dir/.";
    system $cmd;
    $cmd = "cp $dir/fit/ensembles_size_* $dir/.";
    system $cmd;
    print "Done. \n";
    print "</code> \n";
}

#################################sending emails and finishing ####################

sub bilbomd_done {
    print " <code class=\"gold\"> \n";
    print " ********************************************************* \n";
    print " ********************** BILBOMD DONE ********************* \n";
    print " ********************************************************* \n";
    print " ********************************************************* \n";
    $cmd = "rm -f  $dir/fit/*.pdb ";
    system $cmd;
    $cmd =
"rm -f  $dir/*.end* $dir/*.start $dir/*0.inp $dir/*1.inp $dir/*2.inp $dir/*3.inp $dir/*4.inp $dir/*5.inp $dir/*6.inp $dir/*7.inp $dir/*8.inp $dir/*9.inp ";
    system $cmd;
    $cmd =
"rm -f  $dir/*1.out $dir/*2.out $dir/*3.out $dir/*4.out $dir/*5.out $dir/*6.out $dir/*7.out $dir/*8.out $dir/*9.out  ";
    system $cmd;

    # zipping results
    #print "zipping results... \n";

    $cmd =
" cd $dir; zip $file.zip $dat cluster_representatives.txt  multi_state_model* ensembles_size*  const.inp *.pdb ";
    system $cmd;

    $from    = $email;
    $to      = $email;
    $Subject = "BILBOMD DONE!  in  $dir the results are attached";

    # Part using which the attachment is sent to an email #
    $msg = MIME::Lite->new(
        From    => $from,
        To      => $to,
        Subject => $Subject,
        Type    => 'multipart/mixed',
    );

    $msg->attach(
        Type => 'TEXT',
        Data => "Here's the $file.zip of  the bilbomd results"
    );

    $msg->attach(
        Type     => 'application/zip',
        Path     => "$dir/fit/$file.zip",
        Filename => "$file.zip",
    );
    print "Mail Sent\n";
    $msg->send;    # send via default
    exit;
}

sub cleaning {
    print " \n";
    print
      " !!!!!!!!!!  Abnormal Termination !!!!!!!! ...... check status.txt \n";
    print " cleaning ..........................\n";
    $cmd = "rm -f  $dir/fit/*.pdb ";
    system $cmd;
    $cmd =
"rm -f  $dir/*.end* $dir/*.start $dir/*0.inp $dir/*1.inp $dir/*2.inp $dir/*3.inp $dir/*4.inp $dir/*5.inp $dir/*6.inp $dir/*7.inp $dir/*8.inp $dir/*9.inp ";
    system $cmd;
    $cmd2 =
"rm -f  $dir/*1.out $dir/*2.out $dir/*3.out $dir/*4.out $dir/*5.out $dir/*6.out $dir/*7.out $dir/*8.out $dir/*9.out ";
    system $cmd;
    exit;
}
